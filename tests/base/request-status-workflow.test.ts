import { applyD1Migrations } from 'cloudflare:test'
import { beforeAll,expect,inject,it } from 'vitest'
import { mockMail,requester } from './support'
import { env,seedLoop,request,json,publicRequest,committed,approve,row } from './decision-loop-fixture'
beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'));await seedLoop();mockMail()})

it('[REQ-006][REQ-017][REQ-016][REQ-036][PRIO-002][ROAD-014] sets a direct plan and ETA, resolves latest changes, configures private statuses and projects only eligible roadmap cards',async()=>{
 const r=await publicRequest(),get=()=>json<{statusUpdates:{id:string;status:string;body:string}[]}>(request(`/api/public/requests/${r.slug}`)),set=(status:string,extra:Record<string,unknown>={})=>request(`/api/operator/requests/${r.slug}/status-updates`,'POST',{status,...extra})
 const declineHistory=async(...reasons:string[])=>{
  const updates=(await get()).statusUpdates.filter(update=>update.status==='declined')
  expect(updates.map(({status,body})=>({status,body}))).toEqual(expect.arrayContaining(reasons.map(body=>({status:'declined',body}))))
  expect(updates).toHaveLength(reasons.length)
  return updates
 }
 expect(await get()).toMatchObject({status:'open'})
 await json(set('planned',{publicEta:'2027-Q1'}));expect(await get()).toMatchObject({status:'planned',publicEta:'2027-Q1'})
 const count=async()=>Number((await env.DB.prepare('SELECT COUNT(*) n FROM request_status_updates WHERE request_id=?').bind(r.id).first<{n:number}>())!.n)
 const n=await count();await json(set('planned'));expect(await count()).toBe(n)
 const beforeRefusal=await get()
 expect((await set('declined')).status).toBe(400);expect(await get()).toEqual(beforeRefusal);expect((await set('planned',{publicEta:'tomorrow'})).status).toBe(400)
 const internal=await json(request('/api/operator/settings/request-statuses','POST',{name:'Design validation',publicStatus:'in_progress'}),201)
 await json(set('in_progress',{internalStatusId:internal.id}));expect(await get()).toMatchObject({status:'in_progress',statusLabel:null});expect(JSON.stringify(await get())).not.toContain('Design validation')
 const before=await count();await json(request(`/api/operator/settings/request-statuses/${internal.id}`,'PATCH',{publicStatus:'under_review',showPublicLabel:true}))
 expect(await get()).toMatchObject({status:'under_review',statusLabel:'Design validation'});expect(await count()).toBe(before)
 const participant=await requester('Finance customer')
 expect((await request(`/api/public/requests/${r.slug}/vote`,'POST',{},participant)).status).toBe(204)
 const comment=await json(request(`/api/public/requests/${r.slug}/comments`,'POST',{body:'Please keep this workflow available.'},participant),201)
 await json(request(`/api/operator/comments/${comment.id}/moderate`,'POST',{verdict:'approved',publicAuthorDisplayName:'Finance customer'}))
 const c=await committed();await json(request(`/api/operator/roadmap/${c.itemId}/move`,'POST',{status:'in_progress',reason:'Delivery started',idempotencyKey:crypto.randomUUID()}));await approve(c.itemId,[r.id]);expect(await get()).toMatchObject({status:'in_progress',statusLabel:null})
 await json(set('planned'));expect(await get()).toMatchObject({status:'planned'})
 await json(request(`/api/operator/roadmap/${c.itemId}/move`,'POST',{status:'shipped',reason:'Delivered',idempotencyKey:crypto.randomUUID()}));expect(await get()).toMatchObject({status:'shipped'})
 await json(set('declined',{body:'We no longer support this direction.'}));expect(await get()).toMatchObject({status:'declined',voteCount:1,comments:[{body:'Please keep this workflow available.'}]})
 const firstDecline=await declineHistory('We no longer support this direction.')
 expect((await request(`/api/public/requests/${r.slug}/vote`,'POST',{},participant)).status).toBe(409)
 expect((await request(`/api/public/requests/${r.slug}/comments`,'POST',{body:'This must remain held.'},participant)).status).toBe(409)
 await json(set('declined',{body:'The replacement workflow is now available.'}))
 const repeatedDeclines=await declineHistory('We no longer support this direction.','The replacement workflow is now available.')
 expect(repeatedDeclines).toEqual(expect.arrayContaining(firstDecline))
 await json(request(`/api/operator/requests/${r.slug}/decline/reverse`,'POST',{}));expect(await get()).toMatchObject({status:'shipped'})
 expect((await get()).statusUpdates).toEqual(expect.arrayContaining(repeatedDeclines))
 await json(request(`/api/operator/roadmap/${c.itemId}/withdraw`,'POST',{}));expect(await get()).toMatchObject({status:'planned'})
 await json(set('open'))
 await approve(c.itemId,[r.id]);expect(await get()).toMatchObject({status:'shipped'})
 await json(set('declined',{body:'First decline reason.'}))
 await json(set('declined',{body:'Revised decline reason.'}))
 const allDeclines=await declineHistory('We no longer support this direction.','The replacement workflow is now available.','First decline reason.','Revised decline reason.')
 await json(request(`/api/operator/requests/${r.slug}/decline/reverse`,'POST',{}));expect(await get()).toMatchObject({status:'shipped'})
 expect((await get()).statusUpdates).toEqual(expect.arrayContaining(allDeclines))
 await json(request(`/api/operator/roadmap/${c.itemId}/withdraw`,'POST',{}));expect(await get()).toMatchObject({status:'open'})
 await json(set('planned'))
 expect((await request(`/api/public/requests/${r.slug}/vote`,'POST',{},participant)).status).toBe(204)
 await json(request(`/api/public/requests/${r.slug}/comments`,'POST',{body:'Participation is open again.'},participant),201)
 const settings=await json<any>(request('/api/operator/settings/status-roadmap'))
 await json(request('/api/operator/settings/status-roadmap','PUT',{...settings.settings,source:'request_statuses',boardSlugs:['loop-board']}))
 let cards=await json<any[]>(request('/api/public/roadmap'));expect(cards.filter(card=>card.slug===r.slug)).toHaveLength(1);expect(cards.find(card=>card.slug===r.slug)).toMatchObject({status:'planned',publicEta:'2027-Q1',source:'requests'})
 const open=await publicRequest();expect(cards.some(card=>card.slug===open.slug)).toBe(false)
 const hidden={...settings.settings,source:'request_statuses',boardSlugs:['loop-board'],columns:settings.settings.columns.map((column:any)=>({...column,visible:column.status!=='planned'}))}
 await json(request('/api/operator/settings/status-roadmap','PUT',hidden));expect((await json<any[]>(request('/api/public/roadmap'))).some(card=>card.slug===r.slug)).toBe(false)
 await json(request('/api/operator/settings/status-roadmap','PUT',{...hidden,columns:settings.settings.columns,shippedDays:30}));await json(set('shipped'));expect((await json<any[]>(request('/api/public/roadmap'))).some(card=>card.slug===r.slug)).toBe(true)
 await env.DB.prepare("UPDATE requests SET direct_status_changed_at='2020-01-01T00:00:00Z' WHERE id=?").bind(r.id).run();expect((await json<any[]>(request('/api/public/roadmap'))).some(card=>card.slug===r.slug)).toBe(false)
 await json(request('/api/operator/settings/status-roadmap','PUT',{...settings.settings,source:'approved_items'}));await approve(c.itemId,[r.id]);cards=await json<any[]>(request('/api/public/roadmap'));const publishedSlug=await publicationSlug(c.itemId);expect(cards.some(card=>card.slug===publishedSlug)).toBe(true)
 expect(await row('requests',r.id)).toMatchObject({public_eta:'2027-Q1'})
 await env.DB.prepare("UPDATE requests SET public_state='withdrawn',withdrawn_at=? WHERE id=?").bind(new Date().toISOString(),r.id).run()
 expect((await request(`/api/public/requests/${r.slug}`)).status).toBe(410)
 expect(await json(request(`/api/operator/requests/${r.slug}/context`))).toMatchObject({statusDetails:{status:'withdrawn',statusSource:'direct'}})
 await proveVoteStatusEligibility()
})
async function proveVoteStatusEligibility(){
 const r=await publicRequest(),path=`/api/public/requests/${r.slug}`,get=()=>json(request(path))
 const set=(status:string)=>json(request(`/api/operator/requests/${r.slug}/status-updates`,'POST',{status,body:status==='declined'?'This request is outside the current plan.':''}))
 const boards=await json<{slug:string;subscriptionDisclosure:{version:number}}[]>(request('/api/public/boards'))
 const input={emailUpdates:true,subscriptionVersion:boards.find(board=>board.slug==='loop-board')!.subscriptionDisclosure.version}
 const vote=(person:Awaited<ReturnType<typeof requester>>)=>request(`${path}/vote`,'POST',input,person)
 const participation=async()=>{
  const rows=async(table:string)=>(await env.DB.prepare(`SELECT * FROM ${table} WHERE request_id=? ORDER BY requester_id`).bind(r.id).all<Record<string,unknown>>()).results
  return {votes:await rows('request_votes'),contributions:await rows('request_vote_contributions'),permissions:await rows('requester_update_permissions'),follows:await rows('request_follow_contributions')}
 }
 let total=0
 for(const status of ['open','under_review','planned','in_progress']){
  await set(status)
  const person=await requester('Verified status voter')
  expect((await vote(person)).status).toBe(204);expect((await vote(person)).status).toBe(204)
  expect(await get()).toMatchObject({status,voteCount:++total})
 }
 const before=await participation()
 expect(before.votes).toHaveLength(4);expect(before.contributions).toHaveLength(4)
 expect(before.permissions.filter(row=>row.grant_origin==='explicit')).toHaveLength(4)
 const waiting=await requester('Verified waiting voter')
 for(const status of ['declined','shipped']){
  await set(status);const published=await get()
  expect(published).toMatchObject({status,voteCount:4})
  const refused=await vote(waiting)
  expect(refused.status).toBe(409);expect(await refused.json()).toEqual({error:'voting_closed'})
  expect(await participation()).toEqual(before);expect(await get()).toEqual(published)
 }
 await set('open')
 expect((await vote(waiting)).status).toBe(204);expect((await vote(waiting)).status).toBe(204)
 expect(await get()).toMatchObject({status:'open',voteCount:5})
 const after=await participation()
 expect(after.votes).toHaveLength(5);expect(after.contributions).toHaveLength(5)
 expect(new Set(after.votes.map(row=>row.requester_id)).size).toBe(5)
 expect(after.permissions.filter(row=>row.grant_origin==='explicit')).toHaveLength(5)
}
async function publicationSlug(id:string){return (await env.DB.prepare('SELECT public_slug FROM roadmap_publications WHERE roadmap_item_id=?').bind(id).first<{public_slug:string}>())!.public_slug}
