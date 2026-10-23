import {createRequire} from 'node:module'
import {readdir,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
const require=createRequire(import.meta.resolve('@cloudflare/vitest-plugin'))
const {Miniflare,convertV4MiniflareOptions}=require('miniflare')
const {readD1Migrations}=await import('@cloudflare/vitest-plugin')
const modules=[]
for(const path of await readdir('dist/server',{recursive:true}))if(/\.(mjs|js)$/.test(path))modules.push({type:'ESModule',path:resolve('dist/server',path),contents:await readFile('dist/server/'+path,'utf8')})
modules.sort((a,b)=>a.path.endsWith('/index.js')?-1:b.path.endsWith('/index.js')?1:0)
const origin='https://penny.test',setup='synthetic-penny-kill-setup-token-long-enough'
const mf=new Miniflare(convertV4MiniflareOptions({modules,modulesRoot:resolve('dist/server'),cf:false,compatibilityDate:'2026-08-31',compatibilityFlags:['nodejs_compat'],resourcePersistencePath:process.env.PENNY_MAIL_KILL_STATE,d1Databases:{DB:'kill-mail'},r2Buckets:{FILES:'files'},queueProducers:{JOBS:'jobs'},bindings:{PENNY_ENVIRONMENT:'test',APP_ORIGIN:origin,AUTH_SECRET:'synthetic-penny-kill-auth-secret-long-enough',SETUP_TOKEN:setup,OPERATOR_EMAIL:'owner@penny.invalid',MAIL_PROVIDER:'sendgrid',MAIL_API_KEY:'synthetic-penny-mail-key',MAIL_FROM:'penny@example.test'},outboundService:async request=>{
 if(request.url!=='https://api.sendgrid.com/v3/mail/send')throw new Error('Unexpected network destination')
 const body=await request.json()
 process.send({kind:'provider',recipient:body.personalizations[0].to[0].email,text:body.content.find(item=>item.type==='text/plain').value})
 // The edge accepted this message; its response is withheld until this owned process is killed.
 return new Promise(()=>{})
}}))
await mf.ready
const db=await mf.getD1Database('DB')
if(!await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='requests'").first())for(const migration of await readD1Migrations(resolve('migrations/core')))await db.batch(migration.queries.map(sql=>db.prepare(sql)))
const call=(path,body,cookie)=>mf.dispatchFetch(origin+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.79',...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})})
async function command(message){
 if(message.action==='setup'){
  const boot=await call('/auth/bootstrap',{token:setup,displayName:'Owner',returnTo:'/app'})
  if(boot.status!==303)throw new Error('Bootstrap failed: '+boot.status+' '+await boot.text())
  const cookie=boot.headers.get('set-cookie').split(';')[0],stamp=new Date().toISOString(),old=new Date(Date.now()-600000).toISOString()
  await db.batch([
   db.prepare("INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES('synthetic-penny-person','Customer',?,?)").bind(stamp,stamp),
   db.prepare("INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES('synthetic-penny-address','synthetic-penny-person','synthetic-penny-person@example.test',?,?,?)").bind(stamp,stamp,stamp),
   db.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('synthetic-penny-board','synthetic-penny-board','Customer feedback','public',0,?,?)").bind(stamp,stamp),
   db.prepare("INSERT INTO requests(id,slug,board_id,title,description,public_title,public_description,moderation_state,public_state,published_at,created_at,updated_at) VALUES('synthetic-penny-request','synthetic-penny-request','synthetic-penny-board','Customer workflow','Customer problem','Customer workflow','Customer problem','approved','open',?,?,?)").bind(stamp,stamp,stamp),
   db.prepare("INSERT INTO request_follows(request_id,requester_id,permission_granted_at,created_at,updated_at) VALUES('synthetic-penny-request','synthetic-penny-person',?,?,?)").bind(stamp,stamp,stamp),
   db.prepare("INSERT INTO requester_update_permissions(id,requester_id,requester_address_id,request_id,source,granted_at,created_at,updated_at) VALUES('synthetic-penny-permission','synthetic-penny-person','synthetic-penny-address','synthetic-penny-request','follow',?,?,?)").bind(stamp,stamp,stamp),
   db.prepare("INSERT INTO penny_workspace_clock(singleton,timezone,quiet_enabled,quiet_start,quiet_end,confirmed_at,updated_at) VALUES(1,'UTC',0,20,8,?,?)").bind(stamp,stamp),
  ])
  const update=await call('/api/operator/requests/synthetic-penny-request/status-updates',{status:'under_review',body:'synthetic-penny-update'},cookie)
  if(update.status!==200)throw new Error('Status publication failed: '+update.status)
  await db.batch([db.prepare('UPDATE notification_events SET created_at=?').bind(old),db.prepare('UPDATE notification_intents SET created_at=?').bind(old)])
  return {cookie}
 }
 if(message.action==='wake')return (await mf.getWorker()).queue('jobs',[{id:crypto.randomUUID(),timestamp:new Date(),attempts:1,body:{kind:'notifications.drain'}}])
 if(message.action==='age')return db.prepare("UPDATE notification_attempts SET created_at=? WHERE state='sending'").bind(new Date(Date.now()-600000).toISOString()).run()
 if(message.action==='read'){
  const response=await call('/api/operator/notifications',undefined,message.cookie)
  if(response.status!==200)throw new Error('Private notification read failed')
  return response.json()
 }
 if(message.action==='close'){await mf.dispose();setImmediate(()=>process.disconnect());return null}
 throw new Error('Unknown harness command')
}
process.on('message',message=>{void command(message).then(value=>{if(process.connected)process.send({kind:'result',id:message.id,value})}).catch(error=>{if(process.connected)process.send({kind:'result',id:message.id,error:error.message})})})
process.send({kind:'ready'})
