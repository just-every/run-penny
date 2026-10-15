import { createRequire } from 'node:module'
import { resolve,join } from 'node:path'
import { readdir,readFile,mkdtemp,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { freshLocalPort } from './fresh-local-port.mjs'
const require=createRequire(import.meta.resolve('@cloudflare/vitest-plugin'))
const {Miniflare,convertV4MiniflareOptions}=require('miniflare')
const {readD1Migrations}=await import('@cloudflare/vitest-plugin')
/** Execute the exact emitted production modules. External mail and an optional source/model RPC edge are test fixtures. */
export async function startBrowserRuntime({bindings={},https=false,port,networkWorker,mailService}={}){
 port??=await freshLocalPort()
 const origin=`${https?'https':'http'}://127.0.0.1:${port}`,outbox=[],state=await mkdtemp(join(tmpdir(),'penny-base-browser-'))
 const modules=[];for(const path of await readdir('dist/server',{recursive:true}))if(/\.(js|mjs)$/.test(path))modules.push({type:'ESModule',path:resolve('dist/server',path),contents:await readFile(join('dist/server',path),'utf8')})
 modules.sort((a,b)=>a.path.endsWith('/index.js')?-1:b.path.endsWith('/index.js')?1:0)
 const configuration={port,host:'127.0.0.1',https,cf:false,resourcePersistencePath:state,
  modules,modulesRoot:resolve('dist/server'),
  compatibilityDate:'2026-08-31',compatibilityFlags:['nodejs_compat'],
  d1Databases:{DB:'browser-db'},r2Buckets:{FILES:'browser-files'},queueProducers:{JOBS:'browser-jobs'},
  assets:{directory:resolve('dist/client'),binding:'ASSETS',run_worker_first:true,routerConfig:{has_user_worker:true}},
  bindings:{PENNY_ENVIRONMENT:'test',APP_ORIGIN:origin,AUTH_SECRET:'synthetic-base-browser-auth-secret-12345',SETUP_TOKEN:'synthetic-base-browser-setup-token-12345',OPERATOR_EMAIL:'owner@penny.invalid',MAIL_PROVIDER:'sendgrid',MAIL_FROM:'penny@example.test',SENDGRID_API_KEY:'synthetic-browser-provider-key',...bindings},
  outboundService:mailService??(async request=>{
   if(request.url!=='https://api.sendgrid.com/v3/mail/send'||request.method!=='POST'||request.headers.get('Authorization')!=='Bearer synthetic-browser-provider-key')throw new Error('Unexpected provider request')
   const body=await request.json(),text=body.content.find(c=>c.type==='text/plain').value
   outbox.push({email:body.personalizations[0].to[0].email,url:text.match(/https?:\/\/[^\s]+/)[0]})
   return new Response(null,{status:202,headers:{'x-message-id':'synthetic-browser-message'}})
  }),
 }
 const runtimeOptions=()=>{const opts=convertV4MiniflareOptions({...configuration,...(networkWorker?{serviceBindings:{PENNY_LEARNING_EGRESS:networkWorker.name}}:{})});if(networkWorker)opts.workers.push(...convertV4MiniflareOptions(networkWorker).workers);return opts}
 let options=runtimeOptions()
 let mf=new Miniflare(options)
 try{
  console.log("browser-runtime: waiting for workerd");await mf.ready;console.log("browser-runtime: ready")
  let db=await mf.getD1Database('DB');console.log('browser-runtime: D1 ready')
  for(const migration of await readD1Migrations(resolve('migrations/core'))){console.log('browser-runtime: migration',migration.name);await db.batch(migration.queries.map(sql=>db.prepare(sql)))}
  return {origin,outbox,get db(){return db},configure:async patch=>{configuration.bindings={...configuration.bindings,...patch};options=runtimeOptions();await mf.setOptions(options);await mf.ready;db=await mf.getD1Database('DB')},schedule:async()=>{const worker=await mf.getWorker();const result=await worker.scheduled({cron:'* * * * *',scheduledTime:new Date()});if(result.outcome!==undefined&&result.outcome!=='ok')throw new Error('Native Worker scheduled event did not complete');return result},restart:async()=>{await mf.dispose();mf=new Miniflare(options);await mf.ready;db=await mf.getD1Database('DB')},close:async()=>{await mf.dispose();await rm(state,{recursive:true,force:true})}}
 }catch(error){await mf.dispose();await rm(state,{recursive:true,force:true});throw error}
}
