import {applyD1Migrations,reset} from 'cloudflare:test'
import {env} from 'cloudflare:workers'
import {afterEach,beforeEach,expect,inject,it,vi} from 'vitest'
import {createPennyApi} from '@/core/app/api'
import {base64urlEncode,sign} from '@/core/features/auth/tokens'
import {consumeNativeLink} from '@/core/features/auth/native-service'
import {digest} from '@/core/features/auth/native-tokens'
import {eraseEntity,planErasure} from '@/core/features/data/archive'
import {RequestOperatorRepository} from '@/core/features/requests/operator-repository'
import {mergeRequesterIdentities} from '@/core/features/requests/identity-merge'
import {createPennyRuntime} from '@/core/app/runtime'
import {observeD1,barrier} from './review-race-storage'

const origin='https://penny.test',app=createPennyApi(),email='race-person@example.test'
const full=()=>({...env,PENNY_ENVIRONMENT:'production',PORTAL_IDENTITY_SECRET:'synthetic-race-authority'})
const noMail=()=>({...full(),MAIL_PROVIDER:undefined,MAIL_FROM:undefined,SENDGRID_API_KEY:undefined})
const payload=(title:string)=>({title,description:'Identity race probe',boardSlug:'feedback',idempotencyKey:crypto.randomUUID()})
async function headers(commercial=false){
 const encoded=base64urlEncode(new TextEncoder().encode(JSON.stringify({aud:origin,email,displayName:'Race person',issuedAt:new Date().toISOString(),...(commercial?{accountId:'late-private-account',accountName:'Late private account',revenueCents:87531}:{})})))
 return {Origin:origin,'Content-Type':'application/json','X-Penny-Identity':encoded,'X-Penny-Identity-Signature':base64urlEncode(await sign(full().PORTAL_IDENTITY_SECRET,encoded))}
}
async function fixture(){
 const stamp=new Date().toISOString()
 await env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('race-board','feedback','Feedback','public',0,?,?)").bind(stamp,stamp).run()
 await env.DB.prepare("INSERT INTO operators(id,email,display_name,created_at,updated_at) VALUES('merge-operator','operator@example.test','Operator',?,?)").bind(stamp,stamp).run()
 const response=await app.fetch(new Request(origin+'/api/public/requests',{method:'POST',headers:await headers(),body:JSON.stringify(payload('Before race'))}),full())
 expect(response.status).toBe(201)
 return (await env.DB.prepare('SELECT requester_id id FROM requester_addresses WHERE email=?').bind(email).first<{id:string}>())!.id
}
async function snapshot(){
 const tables=await env.DB.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all<{name:string}>()
 const result:Record<string,unknown>={}
 for(const {name} of tables.results)result[name]=(await env.DB.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()).results
 return result
}
type Change='erasure'|'merge'|'reassignment'|'reverification'|'block'
async function change(kind:Change,id:string){
 const stamp=new Date().toISOString()
 if(kind==='erasure'){
  const plan=await planErasure(env.DB,'requesters',id)
  expect(plan.blockedCopies).toEqual([])
  expect((await eraseEntity(env.DB,env.FILES,'requesters',id,plan.planHash)).status).toBe('complete')
 }else if(kind==='merge'||kind==='reassignment'){
  await env.DB.prepare("INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES('survivor','Survivor',?,?)").bind(stamp,stamp).run()
  if(kind==='merge')await mergeRequesterIdentities(createPennyRuntime(full()).database,id,'survivor','merge-operator',stamp)
  else await env.DB.prepare('UPDATE requester_addresses SET requester_id=?,updated_at=? WHERE requester_id=?').bind('survivor',stamp,id).run()
 }else if(kind==='reverification'){
  // Storage fixture represents an already-delivered link. Consumption is real,
  // including its new session; no mail transport or application is mocked.
  const token=crypto.randomUUID()
  await env.DB.prepare("INSERT INTO native_magic_links(id,purpose,email,token_hash,expires_at,created_at,updated_at) VALUES('delivered-link','requester',?,?,?,?,?)").bind(email,await digest(token),new Date(Date.now()+60000).toISOString(),stamp,stamp).run()
  await consumeNativeLink(createPennyRuntime(noMail()),'requester',token)
 }else{
  await new RequestOperatorRepository(createPennyRuntime(full()).database).setRequesterBlocked(id,true,'merge-operator',stamp)
 }
}
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.useRealTimers())
for(const kind of ['erasure','merge','reassignment','reverification','block'] as const){
 it(`[G.3 REQ-002 REQ-023 REQ-024 REQ-031 DATA-003] streamed no-mail submission refuses ${kind} after identity admission without copying personal data`,async()=>{
  const id=await fixture(),reading=barrier();let controller!:ReadableStreamDefaultController<Uint8Array>
  const body=new ReadableStream<Uint8Array>({start(value){controller=value},pull(){reading.release()}},{highWaterMark:0})
  const result=app.fetch(new Request(origin+'/api/public/requests',{method:'POST',headers:await headers(true),body}),noMail())
  await reading.promise
  let after:Awaited<ReturnType<typeof snapshot>>
  try{await change(kind,id);after=await snapshot()}finally{controller.enqueue(new TextEncoder().encode(JSON.stringify(payload('After race'))));controller.close()}
  const response=await result
  expect(response.status).toBe(kind==='block'?403:503)
  expect(await snapshot()).toEqual(after!)
 })
 it(`[G.3 REQ-002 REQ-023 REQ-024 REQ-031 DATA-003] identity write transaction refuses ${kind} after its final read`,async()=>{
  const id=await fixture();let changed=false,after:Awaited<ReturnType<typeof snapshot>>
  const db=observeD1(env.DB,{before:async sql=>{
   if(!changed && sql.some(text=>text.includes('INSERT INTO requester_write_guards'))){changed=true;await change(kind,id);after=await snapshot()}
  }})
  const response=await app.fetch(new Request(origin+'/api/public/requests',{method:'POST',headers:await headers(true),body:JSON.stringify(payload('After race'))}),{...noMail(),DB:db})
  expect(changed).toBe(true);expect(response.status).toBe(503)
  expect(await snapshot()).toEqual(after!)
 })
}
for(const kind of ['erasure','merge','reassignment','reverification','block'] as const){
it(`[G.3 REQ-003 DATA-003] ${kind} after host acceptance rolls back every statement in the submission batch`,async()=>{
 const id=await fixture();let batches=0,after:Awaited<ReturnType<typeof snapshot>>
 const db=observeD1(env.DB,{before:async sql=>{
  if(sql.some(text=>text.includes('INSERT INTO requester_write_guards')) && ++batches===2){await change(kind,id);after=await snapshot()}
 }})
 const response=await app.fetch(new Request(origin+'/api/public/requests',{method:'POST',headers:await headers(),body:JSON.stringify(payload('After race'))}),{...noMail(),DB:db})
 expect(batches).toBe(2);expect(response.status).toBe(409)
 expect(await snapshot()).toEqual(after!)
})
}
it('[G.3 REQ-023 REQ-031] another real verification in the same timestamp invalidates the admitted host generation',async()=>{
 const id=await fixture()
 const timestamp=await env.DB.prepare('SELECT verified_at FROM requester_addresses WHERE requester_id=?').bind(id).first<string>('verified_at')
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(timestamp!))
 let changed=false,after:Awaited<ReturnType<typeof snapshot>>
 const db=observeD1(env.DB,{before:async sql=>{
  if(!changed && sql.some(text=>text.includes('INSERT INTO requester_write_guards'))){
   changed=true;await change('reverification',id)
   expect(await env.DB.prepare('SELECT verified_at FROM requester_addresses WHERE requester_id=?').bind(id).first('verified_at')).toBe(timestamp)
   after=await snapshot()
  }
 }})
 const response=await app.fetch(new Request(origin+'/api/public/requests',{method:'POST',headers:await headers(true),body:JSON.stringify(payload('Same millisecond'))}),{...noMail(),DB:db})
 expect(changed).toBe(true);expect(response.status).toBe(503);expect(await snapshot()).toEqual(after!)
})
