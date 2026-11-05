import {applyD1Migrations,reset} from 'cloudflare:test'
import {exports} from 'cloudflare:workers'
import {expect,inject,vi} from 'vitest'
import {call,env,mockMail,origin,owner,requester} from './support'
import {explicitConsentBoard} from './explicit-consent-board'
import type {PublicRequestDetail} from '@/core/shared/api/public'
import type {RequestContext} from '@/core/features/requests/operator-context'

async function json<T>(response:Promise<Response>,status=200):Promise<T>{
 const result=await response
 expect(result.status,await result.clone().text()).toBe(status)
 return result.json() as Promise<T>
}
const rows=async(sql:string,...values:string[])=>(await env.DB.prepare(sql).bind(...values).all<Record<string,unknown>>()).results
async function custody(id:string):Promise<Record<string,Record<string,unknown>[]>>{
 const tables=['request_votes','request_follows','request_evidence_links','request_vote_contributions','request_follow_contributions','request_evidence_contributions','request_comments','attachments','requester_update_permissions']
 return Object.fromEntries(await Promise.all(tables.map(async table=>[table,await rows(`SELECT * FROM ${table} WHERE request_id=? ORDER BY 1,2`,id)])))
}

export async function proveUnmergeCustody(){
 vi.restoreAllMocks();await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()
 const operator=await owner(),author=await requester('synthetic-penny-author')
 const sourcePerson=await requester('synthetic-penny-source'),targetPerson=await requester('synthetic-penny-canonical'),shared=await requester('synthetic-penny-shared'),later=await requester('synthetic-penny-later')
 expect((await call('/api/operator/boards',{name:'Reversal custody',slug:'custody',visibility:'public'},operator)).status).toBe(201)
 await explicitConsentBoard('custody',(path,method,body)=>call(path,body,operator,method))
 async function request(title:string){
  const {slug}=await json<{slug:string}>(call('/api/public/requests',{title,description:`Original ${title} content`,boardSlug:'custody',idempotencyKey:crypto.randomUUID()},author),201)
  await json(call(`/api/operator/moderation/${slug}`,{verdict:'approved',title:`Public ${title}`,description:`Approved ${title} content`,boardSlug:'custody',displayName:'synthetic-penny-author'},operator))
  const {requestId:id}=await json<RequestContext>(call(`/api/operator/requests/${slug}/context`,undefined,operator))
  return {id,slug}
 }
 const source=await request('Duplicate'),target=await request('Canonical')
 async function participate(slug:string,person:Record<string,string>){
  for(const action of ['vote','follow'])expect((await call(`/api/public/requests/${slug}/${action}`,{},person)).status).toBe(204)
 }
 async function comment(slug:string,person:Record<string,string>,body:string){
  const {id}=await json<{id:string}>(call(`/api/public/requests/${slug}/comments`,{body},person),201)
  await json(call(`/api/operator/comments/${id}/moderate`,{verdict:'approved',publicAuthorDisplayName:'synthetic-penny-commenter'},operator))
  return id
 }
 async function attachment(slug:string,person:Record<string,string>,label:string){
  const bytes=new TextEncoder().encode(label),form=new FormData()
  form.set('file',new File([bytes],`${label}.png`,{type:'image/png'}))
  const {id}=await json<{id:string}>(exports.default.fetch(new Request(origin+`/api/public/requests/${slug}/attachments`,{method:'POST',headers:{Origin:origin,...person},body:form})),201)
  await json(call(`/api/operator/attachments/${id}/moderate`,{verdict:'approved'},operator))
  return {id,bytes}
 }
 async function evidence(label:string,ids:string[]){
  return json<{id:string}>(call('/api/operator/evidence',{sourceType:'free_text',sourceLabel:label,wording:`Evidence ${label}`,observedAt:new Date().toISOString(),requestLinks:ids.map(id=>({id,stance:'supporting'}))},operator),201)
 }
 await participate(source.slug,sourcePerson);await participate(target.slug,targetPerson)
 await participate(source.slug,shared);await participate(target.slug,shared)
 const sourceComment=await comment(source.slug,sourcePerson,'Original duplicate discussion'),targetComment=await comment(target.slug,targetPerson,'Original canonical discussion')
 const sourceFile=await attachment(source.slug,author,'synthetic-penny-source-file'),targetFile=await attachment(target.slug,author,'synthetic-penny-canonical-file')
 const sourceEvidence=await evidence('synthetic-penny-source',[source.id]),targetEvidence=await evidence('synthetic-penny-canonical',[target.id]),sharedEvidence=await evidence('synthetic-penny-overlap',[source.id,target.id])
 await json(call(`/api/operator/requests/${source.slug}/status-updates`,{status:'under_review',body:'Duplicate review history',pinned:true},operator))
 const originalSource=await custody(source.id),originalTarget=await custody(target.id)
 const publicSource=await json<PublicRequestDetail>(call(`/api/public/requests/${source.slug}`))
 const sourceContent=await env.DB.prepare('SELECT title,description,public_title,public_description,author_requester_id,board_id,published_at FROM requests WHERE id=?').bind(source.id).first()
 expect(originalSource.request_votes).toHaveLength(3);expect(originalTarget.request_votes).toHaveLength(3)
 expect(originalSource.request_follows).toHaveLength(2);expect(originalTarget.request_follows).toHaveLength(2)
 expect(originalSource.request_evidence_links).toHaveLength(3);expect(originalTarget.request_evidence_links).toHaveLength(3)

 await json(call(`/api/operator/requests/${source.slug}/merge`,{targetSlug:target.slug,notifySubscribers:false},operator))
 expect((await call(`/api/public/requests/${source.slug}`)).status).toBe(301)
 const merged=await json<RequestContext>(call(`/api/operator/requests/${target.slug}/context`,undefined,operator))
 expect(merged.demand.voteCount).toBe(4);expect(merged.demand.evidenceCount).toBe(5)
 expect(merged.comments.map(row=>row.id).sort()).toEqual([sourceComment,targetComment].sort())
 expect(merged.attachments.map(row=>row.id).sort()).toEqual([sourceFile.id,targetFile.id].sort())
 expect(await rows('SELECT * FROM request_follows WHERE request_id=?',target.id)).toHaveLength(3)

 await participate(target.slug,later)
 const laterComment=await comment(target.slug,later,'Later canonical discussion'),laterFile=await attachment(target.slug,author,'synthetic-penny-later-file'),laterEvidence=await evidence('synthetic-penny-later',[target.id])
 // Record a new canonical link for evidence that arrived from the duplicate.
 await json(call(`/api/operator/evidence/${sourceEvidence.id}/links`,{target:'request',targetId:target.id},operator,'PUT'))
 await json(call(`/api/operator/requests/${target.slug}/status-updates`,{status:'planned',body:'Later canonical status',pinned:false},operator))
 const beforeReversal=await custody(target.id)
 const canonicalOrigins={...beforeReversal,
  request_votes:beforeReversal.request_vote_contributions,
  request_follows:beforeReversal.request_follow_contributions,
  request_evidence_links:beforeReversal.request_evidence_contributions.map(contribution=>({
   ...beforeReversal.request_evidence_links.find(row=>row.evidence_id===contribution.evidence_id),created_at:contribution.created_at,
  })),
  request_comments:beforeReversal.request_comments.filter(row=>row.origin_request_id===target.id),
  attachments:beforeReversal.attachments.filter(row=>row.origin_request_id===target.id),
 }
 const merge=(await rows('SELECT * FROM request_merges WHERE source_request_id=?',source.id))[0]
 const snapshot=async()=>({source:await custody(source.id),target:await custody(target.id),merges:await rows('SELECT * FROM request_merges ORDER BY id'),requests:await rows('SELECT * FROM requests ORDER BY id'),audits:await rows("SELECT * FROM audit_entries WHERE action='request.unmerged' ORDER BY id")})
 const pending=await snapshot(),path=`/api/operator/requests/${source.slug}/unmerge`
 for(const [headers,status] of [[{},401],[sourcePerson,401],[{...operator,Origin:'https://foreign.test'},403]] as const){
  expect((await call(path,{},headers)).status).toBe(status)
  expect(await snapshot()).toEqual(pending)
 }
 // A reversal without its durable audit must roll back the entire graph.
 await env.DB.exec("CREATE TRIGGER refuse_reversal_audit BEFORE INSERT ON audit_entries WHEN NEW.action='request.unmerged' BEGIN SELECT RAISE(ABORT,'synthetic-penny-audit-unavailable'); END")
 expect((await call(path,{},operator)).status).toBe(503)
 expect(await snapshot()).toEqual(pending)
 await env.DB.exec('DROP TRIGGER refuse_reversal_audit')

 const reversalStarted=Date.now()
 await json(call(path,{},operator))
 const reversalFinished=Date.now()
 const reversedAt=await env.DB.prepare('SELECT unmerged_at FROM request_merges WHERE id=?').bind(merge.id).first<string>('unmerged_at')
 expect(Date.parse(reversedAt!)).toBeGreaterThanOrEqual(reversalStarted)
 expect(Date.parse(reversedAt!)).toBeLessThanOrEqual(reversalFinished)
 expect(await custody(source.id)).toEqual(originalSource)
 expect(await custody(target.id)).toEqual(canonicalOrigins)
 expect(await env.DB.prepare('SELECT title,description,public_title,public_description,author_requester_id,board_id,published_at FROM requests WHERE id=?').bind(source.id).first()).toEqual(sourceContent)
 expect(await env.DB.prepare('SELECT merged_into_request_id,merged_at FROM requests WHERE id=?').bind(source.id).first()).toEqual({merged_into_request_id:null,merged_at:null})
 expect(await json<PublicRequestDetail>(call(`/api/public/requests/${source.slug}`))).toEqual(publicSource)
 const restored=await json<RequestContext>(call(`/api/operator/requests/${source.slug}/context`,undefined,operator)),canonical=await json<RequestContext>(call(`/api/operator/requests/${target.slug}/context`,undefined,operator))
 expect(restored.demand).toMatchObject({voteCount:3,evidenceCount:3})
 expect(canonical.demand).toMatchObject({voteCount:4,evidenceCount:5})
 expect(restored.voters.map(row=>row.id)).toEqual(originalSource.request_votes.map(row=>row.requester_id).sort())
 expect(canonical.voters.map(row=>row.id)).toEqual(canonicalOrigins.request_votes.map(row=>row.requester_id).sort())
 expect(restored.comments.map(row=>row.id)).toEqual([sourceComment]);expect(restored.attachments.map(row=>row.id)).toEqual([sourceFile.id])
 const published=await json<PublicRequestDetail>(call(`/api/public/requests/${target.slug}`))
 expect(published.voteCount).toBe(4)
 expect(published.comments.map(row=>row.id).sort()).toEqual([targetComment,laterComment].sort())
 expect(published.attachments.map(row=>row.id).sort()).toEqual([targetFile.id,laterFile.id].sort())
 expect(published.statusUpdates.map(row=>row.body)).toEqual(['Later canonical status'])
 for(const file of [sourceFile,targetFile,laterFile])expect(new Uint8Array(await (await call(`/api/public/attachments/${file.id}`)).arrayBuffer())).toEqual(file.bytes)
 for(const [id,expected] of [[sourceEvidence.id,[source.id,target.id]],[targetEvidence.id,[target.id]],[sharedEvidence.id,[source.id,target.id]],[laterEvidence.id,[target.id]]] as const){
  const links=await json<{targetId:string}[]>(call(`/api/operator/evidence/${id}/links`,undefined,operator))
  expect(links.map(link=>link.targetId).sort()).toEqual([...expected].sort())
 }
 const actor=await env.DB.prepare('SELECT id FROM operators').first('id')
 expect(await rows('SELECT * FROM request_merges WHERE id=?',String(merge.id))).toEqual([{...merge,unmerged_at:reversedAt,unmerged_by_operator_id:actor,updated_at:reversedAt}])
 const audits=await rows("SELECT actor_type,actor_id,entity_type,entity_id,occurred_at,details_json FROM audit_entries WHERE action='request.unmerged'")
 expect(audits).toEqual([{actor_type:'operator',actor_id:actor,entity_type:'request',entity_id:source.id,occurred_at:reversedAt,details_json:JSON.stringify({mergeId:merge.id})}])
 const completed=await snapshot()
 expect((await call(path,{},operator)).status).toBe(409)
 expect(await snapshot()).toEqual(completed)
}
