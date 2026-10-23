import {expect} from 'vitest'

type Call=(path:string,body?:unknown,headers?:Record<string,string>,method?:string)=>Promise<Response>
/** Create through the two shipped doors; publication approves only safe fields. */
export async function proveOperatorPublication(call:Call,db:D1Database,operator:Record<string,string>,evidenceIds:string[],actor:string){
 for(const ids of [evidenceIds.slice(0,1),evidenceIds]){
  const response=await call(ids.length===1?`/api/operator/evidence/${ids[0]}/request`:'/api/operator/requests',{
   title:'synthetic-penny-operator-request',description:'Private working request wording',boardSlug:'feedback',...(ids.length===1?{}:{evidenceIds:ids}),
  },operator)
  expect(response.status).toBe(201)
  const request=await response.json() as {id:string;slug:string}
  const list=await (await call('/api/operator/requests?q=synthetic-penny-operator-request',undefined,operator)).json() as {items:{id:string;evidenceCount:number}[]}
  expect(list.items.find(row=>row.id===request.id)).toMatchObject({evidenceCount:ids.length})
  expect(await db.prepare('SELECT author_operator_id,author_requester_id FROM requests WHERE id=?').bind(request.id).first()).toEqual({author_operator_id:actor,author_requester_id:null})
  // Operator drafts do not create the held requester submission that moderation
  // reviews. Explicit public-wording approval remains a separate action.
  expect((await db.prepare('SELECT id FROM request_content_submissions WHERE request_id=?').bind(request.id).all()).results).toEqual([])
  expect((await db.prepare('SELECT evidence_id FROM request_evidence_links WHERE request_id=? ORDER BY evidence_id').bind(request.id).all<{evidence_id:string}>()).results.map(row=>row.evidence_id)).toEqual([...ids].sort())
  expect((await call(`/api/public/requests/${request.slug}`)).status).toBe(404)
  const approval={verdict:'approved',title:'Approved reporting request',description:'Approved reporting description',boardSlug:'feedback',displayName:'Owner',categoryId:null}
  expect((await call(`/api/operator/moderation/${request.slug}`,approval,operator)).status).toBe(200)
  const published=await (await call(`/api/public/requests/${request.slug}`)).json()
  expect(published).toMatchObject({slug:request.slug,title:approval.title,description:approval.description,board:{slug:approval.boardSlug},authorDisplayName:approval.displayName,category:null,attachments:[],status:'open'})
  expect(JSON.stringify(published)).not.toMatch(/Private working request wording|Private evidence wording|Private speaker|Secret Acme account|987654321|Private sales call attribution/)
  expect((await call(`/api/operator/moderation/${request.slug}`,approval,operator)).status).toBe(409)
  expect(await (await call(`/api/public/requests/${request.slug}`)).json()).toEqual(published)
 }
}
