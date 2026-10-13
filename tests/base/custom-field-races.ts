import { expect, it } from 'vitest'
import { createPennyApi } from '@/core/app/api'
import { call, env, messages, origin, owner, requester } from './support'
import { barrier, observeD1 } from './review-race-storage'

const definitions = '/api/operator/settings/custom-fields'
const management = '/api/operator/settings/operators'
const app = createPennyApi()
async function field(cookie:Record<string,string>, name='Private race field') {
 const response=await call(definitions,{entityType:'account',name,fieldType:'text'},cookie)
 expect(response.status).toBe(201)
 return (await response.json() as {id:string}).id
}
async function account(cookie:Record<string,string>) {
 const actor=await env.DB.prepare("SELECT id FROM operators WHERE email='owner@penny.invalid'").first<string>('id')
 const response=await call('/api/operator/accounts',{name:'Private race account',internalOwnerId:actor},cookie)
 expect(response.status).toBe(201)
 return (await response.json() as {id:string}).id
}
async function peer(cookie:Record<string,string>) {
 const email=`${crypto.randomUUID()}@example.test`
 expect((await call(management,{email},cookie)).status).toBe(202)
 const token=new URL(messages.findLast(message=>message.to===email)!.url).searchParams.get('token')!
 const response=await call('/auth/confirm',{token});expect(response.status).toBe(303)
 const headers={Cookie:response.headers.get('Set-Cookie')!.split(';')[0]}
 const listing=await (await call(management,undefined,cookie)).json() as {operators:{id:string;email:string}[]}
 return {headers,id:listing.operators.find(operator=>operator.email===email)!.id}
}
function mutation(path:string,method:string,input:unknown,cookie:Record<string,string>,db=env.DB,requestOrigin:string|null=origin) {
 return app.fetch(new Request(origin+path,{method,headers:{...cookie,'Content-Type':'application/json',...(requestOrigin===null?{}:{Origin:requestOrigin})},body:JSON.stringify(input)}),{...env,DB:db})
}
function pausedBody(path:string,method:string,input:unknown,cookie:Record<string,string>) {
 const reading=barrier();let controller!:ReadableStreamDefaultController<Uint8Array>
 const body=new ReadableStream<Uint8Array>({start(value){controller=value},pull(){reading.release()}},{highWaterMark:0})
 const response=app.fetch(new Request(origin+path,{method,headers:{...cookie,Origin:origin,'Content-Type':'application/json'},body}),env)
 return {reading:reading.promise,response,release:()=>{controller.enqueue(new TextEncoder().encode(JSON.stringify(input)));controller.close()}}
}

it('[DATA-004 BASE-ACCESS-004] custom-field writes require explicit same origin and reject removal during body read and commit',async()=>{
 const first=await owner(),id=await field(first),entity=await account(first)
 const writes=[
  {path:definitions,method:'POST',input:{entityType:'account',name:'Denied definition',fieldType:'text'},sql:'INSERT INTO custom_field_definitions'},
  {path:`${definitions}/${id}`,method:'PATCH',input:{name:'Denied rename',fieldType:'text'},sql:'UPDATE custom_field_definitions'},
  {path:`/api/operator/custom-fields/account/${id}/${entity}`,method:'PUT',input:{value:'Denied value'},sql:'INSERT INTO custom_field_values'},
 ]
 for(const write of writes)for(const suppliedOrigin of [null,'https://foreign.example.test']) {
  expect((await mutation(write.path,write.method,write.input,first,env.DB,suppliedOrigin)).status).toBe(403)
 }
 const delayedPeer=await peer(first)
 const pending=writes.map(write=>pausedBody(write.path,write.method,write.input,delayedPeer.headers))
 try {
  await Promise.all(pending.map(write=>write.reading))
  expect((await call(`${management}/${delayedPeer.id}`,{},first,'DELETE')).status).toBe(200)
 } finally { pending.forEach(write=>write.release()) }
 for(const write of pending)expect((await write.response).status).toBe(401)
 for(const write of writes) {
  const actor=await peer(first);let raced=false
  const db=observeD1(env.DB,{before:async sql=>{
   if(!raced&&sql.some(statement=>statement.includes(write.sql))) {
    raced=true
    expect((await call(`${management}/${actor.id}`,{},first,'DELETE')).status).toBe(200)
   }
  }})
  expect((await mutation(write.path,write.method,write.input,actor.headers,db)).status).toBe(401)
  expect(raced).toBe(true)
 }
 expect(await env.DB.prepare('SELECT name FROM custom_field_definitions WHERE id=?').bind(id).first('name')).toBe('Private race field')
 expect(await env.DB.prepare("SELECT id FROM custom_field_definitions WHERE name='Denied definition'").first()).toBeNull()
 expect(await env.DB.prepare('SELECT id FROM custom_field_values WHERE definition_id=?').bind(id).first()).toBeNull()
 expect(await env.DB.prepare("SELECT id FROM audit_entries WHERE action='custom_field.definition_updated'").first()).toBeNull()
 const person=await requester()
 for(const headers of [{},person,delayedPeer.headers]) {
  expect((await call(definitions,undefined,headers)).status).toBe(401)
  expect((await call(`/api/operator/custom-fields/account/${entity}`,undefined,headers)).status).toBe(401)
 }
})

it('[DATA-004] concurrent definition edits and value saves cannot commit incompatible typed values',async()=>{
 const cookie=await owner(),id=await field(cookie),entity=await account(cookie)
 const path=`/api/operator/custom-fields/account/${id}/${entity}`
 let changed=false
 const valueDb=observeD1(env.DB,{before:async sql=>{
  if(!changed&&sql.some(statement=>statement.includes('INSERT INTO custom_field_values'))) {
   changed=true
   expect((await call(`${definitions}/${id}`,{name:'Numeric field',fieldType:'number'},cookie,'PATCH')).status).toBe(200)
  }
 }})
 expect((await mutation(path,'PUT',{value:'Stale text'},cookie,valueDb)).status).toBe(409)
 expect(changed).toBe(true)
 expect(await env.DB.prepare('SELECT id FROM custom_field_values WHERE definition_id=?').bind(id).first()).toBeNull()
 expect((await call(`${definitions}/${id}`,{name:'Text again',fieldType:'text'},cookie,'PATCH')).status).toBe(200)
 let saved=false
 const definitionDb=observeD1(env.DB,{before:async sql=>{
  if(!saved&&sql.some(statement=>statement.includes('UPDATE custom_field_definitions'))) {
   saved=true
   expect((await call(path,{value:'New private text'},cookie,'PUT')).status).toBe(200)
  }
 }})
 expect((await mutation(`${definitions}/${id}`,'PATCH',{name:'Rejected numeric field',fieldType:'number'},cookie,definitionDb)).status).toBe(409)
 expect(saved).toBe(true)
 expect(await (await call(`/api/operator/custom-fields/account/${entity}`,undefined,cookie)).json()).toMatchObject([{name:'Text again',fieldType:'text',value:'New private text'}])
 expect(await env.DB.prepare("SELECT id FROM audit_entries WHERE action='custom_field.definition_updated' AND json_extract(details_json,'$.name')='Rejected numeric field'").first()).toBeNull()

 // Retained values may predate the current type rules. Conversion validates
 // their actual JSON, including UTF-16 text length, finite numbers and dates.
 const cases:[string,string,boolean][]=[
  ['text',JSON.stringify('a\u0000b'),true],['text',JSON.stringify('😀'.repeat(10000)),true],
  ['text',JSON.stringify('ø'.repeat(20000)),true],['text',JSON.stringify('😀'.repeat(10000)+'a'),false],
  ['text',JSON.stringify('\u0000'+'x'.repeat(20000)),false],['text','{}',false],
  ['number','0',true],['number','1.7976931348623157e308',true],['number','-1e999',false],
  ['number','1e999',false],['number','"5"',false],['number','null',true],
  ['boolean','true',true],['boolean','false',true],['boolean','1',false],
  ['date','"2000-02-29"',true],['date','"1900-02-29"',false],['date','"2026-04-31"',false],
  ['date','"0000-01-01"',false],['date',JSON.stringify('2024-02-29\u0000'),false],
  ['date','"2024-02-29',false],['date','null',true],['boolean','true\u0000garbage',false],
 ]
 for(const [fieldType,valueJson,allowed] of cases) {
  const prior=fieldType==='text'?'date':'text'
  await env.DB.batch([
   env.DB.prepare('UPDATE custom_field_definitions SET field_type=? WHERE id=?').bind(prior,id),
   env.DB.prepare('UPDATE custom_field_values SET value_json=? WHERE definition_id=?').bind(valueJson,id),
  ])
  const before=await env.DB.prepare("SELECT COUNT(*) AS count FROM audit_entries WHERE action='custom_field.definition_updated' AND entity_id=?").bind(id).first<number>('count')
  expect((await call(`${definitions}/${id}`,{name:'Validated conversion',fieldType},cookie,'PATCH')).status).toBe(allowed?200:409)
  expect(await env.DB.prepare('SELECT field_type FROM custom_field_definitions WHERE id=?').bind(id).first('field_type')).toBe(allowed?fieldType:prior)
  expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM audit_entries WHERE action='custom_field.definition_updated' AND entity_id=?").bind(id).first('count')).toBe(before!+(allowed?1:0))
 }

 // Many maximum-size values exceed D1's single-row result limit if the server
 // builds a snapshot. Both rejection and success must keep those values in D1.
 const prefix=crypto.randomUUID(),now=new Date().toISOString()
 await env.DB.batch([
  env.DB.prepare('UPDATE custom_field_definitions SET field_type=? WHERE id=?').bind('text',id),
  env.DB.prepare('UPDATE custom_field_values SET value_json=? WHERE definition_id=?').bind('null',id),
  env.DB.prepare(`WITH RECURSIVE rows(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM rows WHERE n<128)
   INSERT INTO accounts(id,slug,name,created_at,updated_at) SELECT ?||n,?||n,'Bulk private account',?,? FROM rows`).bind(prefix,prefix,now,now),
  env.DB.prepare(`INSERT INTO custom_field_values(id,definition_id,entity_id,value_json,created_at,updated_at)
   SELECT id,?,id,json_quote(?),?,? FROM accounts WHERE substr(id,1,length(?))=?`).bind(id,'x'.repeat(20000),now,now,prefix,prefix),
 ])
 const retained=await env.DB.prepare('SELECT COUNT(*) AS count,SUM(length(value_json)) AS size FROM custom_field_values WHERE definition_id=?').bind(id).first()
 expect((await call(`${definitions}/${id}`,{name:'Large rejected conversion',fieldType:'number'},cookie,'PATCH')).status).toBe(409)
 expect(await env.DB.prepare('SELECT COUNT(*) AS count,SUM(length(value_json)) AS size FROM custom_field_values WHERE definition_id=?').bind(id).first()).toEqual(retained)
 await env.DB.prepare('UPDATE custom_field_values SET value_json=? WHERE definition_id=?').bind('null',id).run()
 await env.DB.exec("CREATE TRIGGER test_definition_audit_failure BEFORE INSERT ON audit_entries WHEN NEW.action='custom_field.definition_updated' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END")
 expect((await call(`${definitions}/${id}`,{name:'Large converted field',fieldType:'boolean'},cookie,'PATCH')).status).toBe(503)
 expect(await env.DB.prepare('SELECT field_type FROM custom_field_definitions WHERE id=?').bind(id).first('field_type')).toBe('text')
 await env.DB.exec('DROP TRIGGER test_definition_audit_failure')
 expect((await call(`${definitions}/${id}`,{name:'Large converted field',fieldType:'boolean'},cookie,'PATCH')).status).toBe(200)
 expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM custom_field_values WHERE definition_id=?').bind(id).first('count')).toBe(retained!.count)
})

it('[DATA-004 BASE-OPS-005] an erased entity cannot regain a value and clearing rolls back with its audit',async()=>{
 const cookie=await owner(),id=await field(cookie),entity=await account(cookie)
 const path=`/api/operator/custom-fields/account/${id}/${entity}`
 expect((await call(path,{value:'Private retained value'},cookie,'PUT')).status).toBe(200)
 await env.DB.exec("CREATE TRIGGER test_clear_audit_failure BEFORE INSERT ON audit_entries WHEN NEW.action='custom_field.value_cleared' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END")
 expect((await call(path,{value:null},cookie,'PUT')).status).toBe(503)
 expect(await (await call(`/api/operator/custom-fields/account/${entity}`,undefined,cookie)).json()).toMatchObject([{value:'Private retained value'}])
 await env.DB.exec('DROP TRIGGER test_clear_audit_failure')
 expect((await call(path,{value:null},cookie,'PUT')).status).toBe(200)
 expect(await env.DB.prepare("SELECT entity_id FROM audit_entries WHERE action='custom_field.value_cleared'").first('entity_id')).toBe(entity)
 let erased=false
 const db=observeD1(env.DB,{before:async sql=>{
  if(!erased&&sql.some(statement=>statement.includes('INSERT INTO custom_field_values'))) {
   erased=true
   const root={table:'accounts',id:entity}
   const preview=await call('/api/operator/data/erasure/preview',root,cookie);expect(preview.status).toBe(200)
   const {planHash}=await preview.json() as {planHash:string}
   expect((await call('/api/operator/data/erasure',{...root,planHash},cookie)).status).toBe(200)
  }
 }})
 expect((await mutation(path,'PUT',{value:'Erased private value'},cookie,db)).status).toBe(409)
 expect(erased).toBe(true)
 expect((await call(`/api/operator/custom-fields/account/${entity}`,undefined,cookie)).status).toBe(404)
 expect(await env.DB.prepare('SELECT id FROM custom_field_values WHERE entity_id=?').bind(entity).first()).toBeNull()
})
