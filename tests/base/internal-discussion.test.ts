import { applyD1Migrations,reset } from 'cloudflare:test'
import { afterEach,beforeEach,expect,inject,it,vi } from 'vitest'
import { call,env,mockMail,owner,requester } from './support'
import { good,peer } from './ownership-fixture'
beforeEach(async()=>{await reset();mockMail()})
afterEach(()=>vi.restoreAllMocks())
async function setup(){
 await applyD1Migrations(env.DB,inject('migrations'))
 const cookie=await owner(),other=await peer(cookie)
 await good('/api/operator/boards',{slug:'discussion',name:'Discussion',visibility:'public'},cookie,'POST',201)
 const request=await good('/api/operator/requests',{title:'Discussion request',description:'Public description',boardSlug:'discussion'},cookie,'POST',201)
 return {cookie,other,request}
}
it('[TRIAGE-004] a selected mention persists once across retries and dismissal; replies stay private',async()=>{
 const {cookie,other,request}=await setup(),path=`/api/operator/discussion/requests/${request.slug}/notes`
 const input={body:'Private root discussion',mentionOperatorIds:[other.id,other.id],idempotencyKey:crypto.randomUUID()}
 const root=await good(path,input,cookie,'POST',201)
 await good(path,input,cookie,'POST',201)
 const reply=await good(path,{body:'Private threaded reply',parentNoteId:root.id,mentionOperatorIds:[other.id]},cookie,'POST',201)
 const notices=await good<{mentions:{noteId:string}[]}>('/api/operator/discussion/mentions',undefined,other.cookie)
 expect(notices.mentions.map(row=>row.noteId).sort()).toEqual([root.id,reply.id].sort())
 expect((await good<{mentions:unknown[]}>('/api/operator/discussion/mentions',undefined,cookie)).mentions).toEqual([])
 await good(`/api/operator/discussion/mentions/${root.id}/dismiss`,{},other.cookie)
 await good(path,input,cookie,'POST',201)
 expect((await good<{mentions:{noteId:string}[]}>('/api/operator/discussion/mentions',undefined,other.cookie)).mentions.map(row=>row.noteId)).toEqual([reply.id])
 expect((await call(path,{...input,body:'Changed wording'},cookie)).status).toBe(409)
 expect((await call(path,{body:'Too deep',parentNoteId:reply.id},cookie)).status).toBe(409)
 await good(`/api/operator/moderation/${request.slug}`,{verdict:'approved',title:'Public request',description:'Public description',boardSlug:'discussion',displayName:'Operator'},cookie)
 const serialized=JSON.stringify(await good(`/api/public/requests/${request.slug}`))
 for(const secret of [input.body,'Private threaded reply',other.id,root.id,reply.id])expect(serialized).not.toContain(secret)
 const identity=await requester('Visitor')
 for(const route of [path,'/api/operator/discussion/mentions','/api/operator/discussion/operators'])expect((await call(route,undefined,identity)).status).toBe(401)
 expect((await call(path,{body:'Cross origin'}, {...cookie,Origin:'https://elsewhere.test'})).status).toBe(403)
 await good(`/api/operator/settings/operators/${other.nativeId}`,{},cookie,'DELETE')
 expect((await call(path,{body:'Inactive mention',mentionOperatorIds:[other.id]},cookie)).status).toBe(409)
 expect(await env.DB.prepare("SELECT id FROM request_notes WHERE body='Inactive mention'").first()).toBeNull()
 const exported=await good<{archive:{tables:Record<string,unknown[]>}}>('/api/operator/data/export',undefined,cookie)
 expect(exported.archive.tables.penny_note_mentions).toHaveLength(2)
 expect(exported.archive.tables).not.toHaveProperty('penny_discussion_guards')
 const target={table:'requests',id:request.id},preview=await good<{planHash:string}>('/api/operator/data/erasure/preview',target,cookie)
 await good('/api/operator/data/erasure',{...target,planHash:preview.planHash},cookie)
 expect(await env.DB.prepare('SELECT * FROM penny_note_mentions').all()).toMatchObject({results:[]})
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
it('[TRIAGE-004] upgrading populated notes preserves the original discussion and accepts a threaded reply',async()=>{
 const migrations=inject('migrations') as {name:string}[],cut=migrations.findIndex(row=>row.name.startsWith('0074_'))
 await applyD1Migrations(env.DB,migrations.slice(0,cut) as never)
 const cookie=await owner()
 await good('/api/operator/boards',{slug:'legacy-notes',name:'Legacy',visibility:'public'},cookie,'POST',201)
 const request=await good('/api/operator/requests',{title:'Existing discussion',description:'Original request',boardSlug:'legacy-notes'},cookie,'POST',201)
 const actor=await env.DB.prepare('SELECT id FROM operators LIMIT 1').first<string>('id')
 await env.DB.prepare('INSERT INTO request_notes(id,request_id,operator_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),request.id,actor,'Existing private note','2026-10-18T00:00:00Z','2026-10-18T00:00:00Z').run()
 const before=await env.DB.prepare('SELECT * FROM request_notes').first<{id:string;body:string}>()
 await applyD1Migrations(env.DB,migrations as never);await applyD1Migrations(env.DB,migrations as never)
 const after=await env.DB.prepare('SELECT * FROM request_notes WHERE id=?').bind(before!.id).first()
 expect(after).toMatchObject(before!);expect(after?.parent_note_id).toBeNull()
 await good(`/api/operator/discussion/requests/${request.slug}/notes`,{body:'Reply after upgrade',parentNoteId:before!.id},cookie,'POST',201)
})
