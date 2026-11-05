import {expect,vi} from 'vitest'
import {call,env,requester} from './support'
import {explicitConsentBoard} from './explicit-consent-board'

/** Compare persisted product custody, including empty delivery stages, after a refused submission. */
async function custody() {
 const tables=['requests','evidence_items','evidence_versions','request_evidence_links','request_submission_keys',
  'request_content_submissions','request_votes','request_follows','request_comments','request_vote_contributions',
  'request_follow_contributions','request_evidence_contributions','requester_update_permissions',
  'request_status_updates','request_moderation_events','notification_outbox','notification_outbox_attempts',
  'notification_events','notification_batches','notification_intents','notification_attempts','notification_delivery_facts','audit_entries']
 const results=await env.DB.batch<Record<string,unknown>>(tables.map(table=>env.DB.prepare(`SELECT * FROM ${table}`)))
 return Object.fromEntries(tables.map((table,index)=>[table,results[index].results.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]))
}

export async function proveBoardManagement(operator:Record<string,string>,person:Record<string,string>,slug:string) {
 const supporter=await requester('Board supporter')
 expect((await call(`/api/public/requests/${slug}/vote`,{},supporter)).status).toBe(204)
 expect((await call(`/api/public/requests/${slug}/follow`,{},supporter)).status).toBe(204)
 const commentResponse=await call(`/api/public/requests/${slug}/comments`,{body:'Keep this customer discussion when the board changes.'},supporter)
 expect(commentResponse.status).toBe(201)
 const {id:commentId}=await commentResponse.json() as {id:string}
 expect((await call(`/api/operator/comments/${commentId}/moderate`,{verdict:'approved',publicAuthorDisplayName:'Board supporter'},operator)).status).toBe(200)
 expect((await call(`/api/operator/requests/${slug}/status-updates`,{status:'under_review',body:'Reviewing this customer workflow.'},operator)).status).toBe(200)
 const before=await custody(),requestId=before.requests[0].id
 expect(before.request_votes).toHaveLength(2)
 expect(before.request_comments).toContainEqual(expect.objectContaining({id:commentId,moderation_state:'approved'}))
 expect(before.request_follows).toHaveLength(1)
 expect(before.request_evidence_links).toHaveLength(1)
 expect(before.requester_update_permissions).toHaveLength(1)
 expect(before.notification_events.length).toBeGreaterThan(0)
 const publicBefore=await (await call(`/api/public/requests/${slug}`)).json() as Record<string,unknown>
 expect(publicBefore).toMatchObject({slug,voteCount:2,comments:[{id:commentId}],board:{slug:'product',name:'Product feedback'}})
 expect((await call('/api/operator/boards',{slug:'research',name:'Research',visibility:'public'},operator)).status).toBe(201)
 await explicitConsentBoard('research',(path,method,body)=>call(path,body,operator,method))
 expect((await call('/api/operator/boards/product',{name:'Customer ideas',position:2},operator,'PATCH')).status).toBe(200)
 expect((await call('/api/operator/boards/research',{position:0},operator,'PATCH')).status).toBe(200)
 const settings=await (await call('/api/operator/catalog/settings',undefined,operator)).json() as {boards:{slug:string;name:string;position:number}[]}
 expect(settings.boards.map(board=>({slug:board.slug,name:board.name,position:board.position}))).toEqual([
  {slug:'research',name:'Research',position:0},{slug:'product',name:'Customer ideas',position:2},
 ])
 const directory=await (await call('/api/public/boards')).json() as {slug:string;name:string}[]
 expect(directory.map(board=>({slug:board.slug,name:board.name}))).toEqual([{slug:'research',name:'Research'},{slug:'product',name:'Customer ideas'}])
 const beforeMove=await custody()
 expect((await call(`/api/operator/requests/${slug}/board`,{boardSlug:'research'},person,'PATCH')).status).toBe(401)
 expect(await custody()).toEqual(beforeMove)
 expect((await call(`/api/operator/requests/${slug}/board`,{boardSlug:'research'},operator,'PATCH')).status).toBe(200)
 const afterMove=await custody()
 for(const table of Object.keys(beforeMove).filter(table=>table!=='requests'&&table!=='audit_entries'))expect(afterMove[table],`moving a request preserves ${table}`).toEqual(beforeMove[table])
 const {board_id:oldBoard,updated_at:oldTime,...original}=beforeMove.requests[0]
 const {board_id:newBoard,updated_at:newTime,...moved}=afterMove.requests[0]
 expect(moved).toEqual(original);expect(newBoard).not.toBe(oldBoard);expect(Date.parse(String(newTime))).toBeGreaterThanOrEqual(Date.parse(String(oldTime)))
 expect(afterMove.audit_entries).toContainEqual(expect.objectContaining({action:'request.board_changed',entity_id:requestId,actor_type:'operator'}))
 const context=await (await call(`/api/operator/requests/${slug}/context`,undefined,operator)).json()
 expect(context).toMatchObject({requestId,boardSlug:'research',demand:{voteCount:2,evidenceCount:1},comments:[{id:commentId}]})
 expect(await (await call(`/api/public/requests/${slug}`)).json()).toEqual({...publicBefore,board:{slug:'research',name:'Research'}})
 const activity=await (await call('/api/public/requester/activity',undefined,supporter)).json() as {follows:{slug:string}[];votes:{slug:string}[]}
 expect(activity.follows.map(row=>row.slug)).toEqual([slug]);expect(activity.votes.map(row=>row.slug)).toEqual([slug])
 console.log('PROBE REQ-018 point 1: native create, rename, reorder and move -> ordered settings and portal boards; same request, votes, comments, follows, permissions and evidence; requester move refused unchanged')
 expect((await call('/api/operator/boards/research',{archived:true},operator,'PATCH')).status).toBe(200)
 expect((await (await call('/api/public/boards')).json() as {slug:string}[]).map(board=>board.slug)).toEqual(['product'])
 expect(await (await call(`/api/public/requests/${slug}`)).json()).toEqual({...publicBefore,board:{slug:'research',name:'Research'}})
 const archived=await custody(),outbound=vi.mocked(fetch).mock.calls.length
 const submission={title:'Fresh valid board submission',description:'This request must remain unsaved while the board is archived.',boardSlug:'research',idempotencyKey:crypto.randomUUID(),emailUpdates:true}
 const refused=await call('/api/public/requests',submission,person)
 expect(refused.status).toBe(409);expect(await refused.json()).toMatchObject({error:'board_unavailable'})
 expect(await custody()).toEqual(archived)
 expect(vi.mocked(fetch).mock.calls.length).toBe(outbound)
 // Reopening admits the very same input, proving the archived attempt was otherwise valid.
 expect((await call('/api/operator/boards/research',{archived:false},operator,'PATCH')).status).toBe(200)
 const accepted=await call('/api/public/requests',submission,person)
 expect(accepted.status).toBe(201)
 expect(await accepted.json()).toMatchObject({moderationState:'awaiting_review'})
 expect((await custody()).requests).toHaveLength(archived.requests.length+1)
 expect((await call(`/api/operator/requests/${slug}/board`,{boardSlug:'product'},operator,'PATCH')).status).toBe(200)
 console.log('PROBE REQ-018 point 2: populated board archived -> absent from navigation, original public URL 200; fresh verified submission 409 board_unavailable with complete product custody unchanged; reopened board accepts it')
}
