import {applyD1Migrations,reset} from 'cloudflare:test'
import {expect,inject} from 'vitest'
import {call,env,mockMail,owner} from './support'
import {assign,catalog,good,peer} from './ownership-fixture'
type Batch={id:string;selected:number;changed:number}
export async function proveRequestBatches(){
 await reset();mockMail()
 const migrations=inject('migrations') as {name:string}[]
 await applyD1Migrations(env.DB,migrations.slice(0,migrations.findIndex(row=>row.name.startsWith('0093_'))) as never)
 const cookie=await owner(),self=(await catalog(cookie)).operators[0]
 await good('/api/operator/boards',{slug:'bulk-finance',name:'Finance requests',visibility:'public'},cookie,'POST',201)
 const requests:{id:string;slug:string}[]=[]
 for(let index=0;index<200;index++)requests.push(await good('/api/operator/requests',{title:`Finance export workflow ${index+1}`,description:'A customer needs a reliable monthly export.',boardSlug:'bulk-finance'},cookie,'POST',201))
 const before=await env.DB.prepare('SELECT id,title,updated_at FROM requests ORDER BY id').all()
 await applyD1Migrations(env.DB,migrations as never)
 expect((await env.DB.prepare('SELECT id,title,updated_at FROM requests ORDER BY id').all()).results).toEqual(before.results)
 const other=await peer(cookie),tag=await good<{id:string}>('/api/operator/catalog/tags',{name:'Finance review'},cookie,'POST',201)
 const original=await good<{id:string}>('/api/operator/catalog/tags',{name:'Existing customer context'},cookie,'POST',201)
 await good(`/api/operator/catalog/requests/${requests[0].id}/tags/${original.id}`,{},cookie,'PUT')
 await assign('requests',requests[0].slug,self.id,cookie)
 const snapshot=async()=>({owners:(await env.DB.prepare('SELECT * FROM penny_request_owners ORDER BY request_id').all()).results,tags:(await env.DB.prepare('SELECT * FROM request_tag_assignments ORDER BY request_id,tag_id').all()).results})
 const initial=await snapshot(),ids=requests.map(row=>row.id),input={requestIds:ids,tagId:tag.id,operatorId:other.id}
 expect((await call('/api/operator/triage/batches',input,other.cookie)).status).toBe(403)
 expect((await good<{canManage:boolean}>('/api/operator/triage/batches/options',undefined,other.cookie)).canManage).toBe(false)
 expect((await call('/api/operator/triage/batches',{...input,requestIds:[...ids.slice(1),'missing-request']},cookie)).status).toBe(409)
 expect(await snapshot()).toEqual(initial)
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_request_batches').first('n')).toBe(0)
 const batch=await good<Batch>('/api/operator/triage/batches',input,cookie,'POST',201)
 expect(batch).toMatchObject({selected:200,changed:200})
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_request_batch_items WHERE batch_id=?').bind(batch.id).first('n')).toBe(200)
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_request_owners WHERE operator_id=?').bind(other.id).first('n')).toBe(200)
 expect(await env.DB.prepare('SELECT count(*) n FROM request_tag_assignments WHERE tag_id=?').bind(tag.id).first('n')).toBe(200)
 expect(await env.DB.prepare("SELECT count(*) n FROM audit_entries WHERE action='triage.batch_applied' AND entity_id=?").bind(batch.id).first('n')).toBe(1)
 const undone=await good(`/api/operator/triage/batches/${batch.id}/undo`,{},cookie)
 expect(undone).toMatchObject({id:batch.id,restored:200,skipped:0,undone:true})
 expect(await snapshot()).toEqual(initial)
 expect(await good(`/api/operator/triage/batches/${batch.id}/undo`,{},cookie)).toEqual(undone)
 expect(await env.DB.prepare("SELECT count(*) n FROM audit_entries WHERE action='triage.batch_undone' AND entity_id=?").bind(batch.id).first('n')).toBe(1)
 const second=await good<Batch>('/api/operator/triage/batches',{...input,requestIds:ids.slice(0,2)},cookie,'POST',201)
 await assign('requests',requests[0].slug,self.id,cookie)
 expect(await good(`/api/operator/triage/batches/${second.id}/undo`,{},cookie)).toMatchObject({restored:1,skipped:1})
 expect(await env.DB.prepare('SELECT operator_id FROM penny_request_owners WHERE request_id=?').bind(requests[0].id).first('operator_id')).toBe(self.id)
 expect(await env.DB.prepare('SELECT count(*) n FROM request_tag_assignments WHERE request_id=? AND tag_id=?').bind(requests[0].id,tag.id).first('n')).toBe(1)
}
