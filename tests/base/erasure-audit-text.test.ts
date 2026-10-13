import { applyD1Migrations,reset } from 'cloudflare:test'
import { afterEach,beforeEach,expect,inject,it,vi } from 'vitest'
import { call,env,mockMail,owner,requester } from './support'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()})
afterEach(()=>vi.restoreAllMocks())
it('[DATA-003] erasing a short name refuses, and never rewrites, another person\'s longer audit text',async()=>{
 const operator=await owner()
 expect((await call('/api/operator/boards',{name:'Product feedback',slug:'product',visibility:'public'},operator)).status).toBe(201)
 await requester('Mark');const other=await requester('Other person')
 const submitted=await call('/api/public/requests',{title:'Export options',description:'Other person wording',boardSlug:'product',idempotencyKey:crypto.randomUUID()},other);expect(submitted.status).toBe(201)
 const slug=(await submitted.json() as {slug:string}).slug,request=(await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(slug).first<{id:string}>())!
 expect((await call('/api/operator/moderation/'+slug,{verdict:'rejected',reason:'Needs detail'},operator)).status).toBe(200)
 expect((await call('/api/public/requests/'+slug+'/appeals',{subjectType:'request',subjectId:request.id,body:'Please reconsider'},other)).status).toBe(201)
 const appeal=(await env.DB.prepare('SELECT id FROM request_moderation_appeals').first<{id:string}>())!
 expect((await call('/api/operator/appeals/'+appeal.id+'/review',{resolution:'dismiss',reason:'Marketing copy was off-topic'},operator)).status).toBe(200)
 const audit=()=>env.DB.prepare("SELECT * FROM audit_entries WHERE action='request.appeal_reviewed'").first()
 const before=await audit(),id=(await env.DB.prepare("SELECT id FROM requesters WHERE display_name='Mark'").first<{id:string}>())!.id
 const preview=await call('/api/operator/data/erasure/preview',{table:'requesters',id},operator),plan=await preview.json() as {planHash:string;counts:Record<string,number>;blockedCopies:{table:string}[]}
 expect(plan.counts.audit_anonymized).toBe(0);expect(plan.blockedCopies.map(copy=>copy.table)).toContain('audit_entries')
 const refused=await call('/api/operator/data/erasure',{table:'requesters',id,planHash:plan.planHash},operator)
 expect(refused.status).toBe(409);expect(await audit()).toEqual(before)
})
