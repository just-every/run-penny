// Test-only TLS listener around the emitted production Worker, with real D1/R2.
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
import {createServer} from 'node:net'
import {request as httpsRequest} from 'node:https'
import {readFile,readdir,chmod} from 'node:fs/promises'
import {resolve,join} from 'node:path'
const require=createRequire(import.meta.resolve('@cloudflare/vitest-plugin'))
const {Miniflare,convertV4MiniflareOptions,Log,LogLevel}=require('miniflare')
const {readD1Migrations}=await import('@cloudflare/vitest-plugin')
export async function tlsIdentity(directory) {
 const key=join(directory,'test-server.key'),certificate=join(directory,'test-server.crt')
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1','-keyout',key,'-out',certificate],{stdio:'ignore'})
 await chmod(key,0o600);return {key:await readFile(key,'utf8'),cert:await readFile(certificate,'utf8'),certificate}
}
async function port() {
 const server=createServer();await new Promise((r,j)=>server.once('error',j).listen(0,'127.0.0.1',r))
 const value=server.address().port;await new Promise(r=>server.close(r));return value
}
export function tlsCall(identity,url,body,headers={}) {
 return new Promise((resolve,reject)=>{
  const request=httpsRequest(url,{ca:identity.cert,agent:false,method:body===undefined?'GET':'POST',headers:{Origin:new URL(url).origin,'CF-Connecting-IP':'192.0.2.27',...headers,...(body===undefined?{}:{'Content-Type':'application/json'})}},response=>{
   const chunks=[];response.on('data',bytes=>chunks.push(bytes));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,text:Buffer.concat(chunks).toString('utf8')}));response.on('error',reject)
  });request.on('error',reject);request.setTimeout(180000,()=>request.destroy(new Error('test_tls_timeout')));request.end(body===undefined?undefined:JSON.stringify(body))
 })
}
export async function workerRuntime(directory,identity,environment='production',{assets=false,beforeExportList}={}) {
 const origin='https://127.0.0.1:'+await port(),modules=[];let outboundCalls=0,mf
 for(const path of await readdir('dist/server',{recursive:true}))if(/\.(mjs|js)$/.test(path))modules.push({type:'ESModule',path:resolve('dist/server',path),contents:await readFile(join('dist/server',path),'utf8')})
 modules.sort((a,b)=>a.path.endsWith('/index.js')?-1:b.path.endsWith('/index.js')?1:0)
 // Optional test-only storage transport delay. The emitted application and every
 // R2 method/result remain real; only an export's list request waits at its edge.
 if(beforeExportList)modules.unshift({type:'ESModule',path:resolve('dist/server/test-export-list-gate.mjs'),contents:`
import worker from './index.js'
export default {
 ...worker,
 fetch(request,bindings,execution) {
  if(new URL(request.url).pathname!=='/api/operator/data/export')return worker.fetch(request,bindings,execution)
  const files=new Proxy(bindings.FILES,{get(bucket,key){
   if(key==='list')return async(...args)=>{
    const gate=await bindings.TEST_EXPORT_LIST_GATE.fetch('https://test-export-list-gate.invalid/')
    if(!gate.ok)throw new Error('test_export_storage_gate_failed')
    return bucket.list(...args)
   }
   const value=Reflect.get(bucket,key,bucket);return typeof value==='function'?value.bind(bucket):value
  }})
  return worker.fetch(request,{...bindings,FILES:files},execution)
 }
}
`})
 const options=convertV4MiniflareOptions({modules,modulesRoot:resolve('dist/server'),cf:false,compatibilityDate:'2026-08-31',compatibilityFlags:['nodejs_compat'],
  host:'127.0.0.1',port:Number(new URL(origin).port),https:true,httpsKey:identity.key,httpsCert:identity.cert,logRequests:false,log:new Log(LogLevel.NONE),
  resourcePersistencePath:directory,d1Databases:{DB:'archive-test'},r2Buckets:{FILES:'files'},queueProducers:{JOBS:'jobs'},
  ...(assets?{assets:{directory:resolve('dist/client'),binding:'ASSETS',run_worker_first:true,routerConfig:{has_user_worker:true}}}:{}),
  ...(beforeExportList?{serviceBindings:{TEST_EXPORT_LIST_GATE:async()=>{await beforeExportList();return new Response(null,{status:204})}}}:{}),
  outboundService:()=>{outboundCalls++;throw new Error('Unexpected test provider call')},
  bindings:{PENNY_ENVIRONMENT:environment,APP_ORIGIN:origin,AUTH_SECRET:'synthetic-test-runtime-secret-at-least-32-characters',OPERATOR_EMAIL:'owner@example.test',SETUP_TOKEN:'synthetic-test-bootstrap-token-at-least-32-characters'}})
 async function start() {mf=new Miniflare(options);try{await mf.ready}catch(error){await mf.dispose();mf=undefined;throw error}}
 await start()
 return {origin,get outboundCalls(){return outboundCalls},async db(){return mf.getD1Database('DB')},async bucket(){return mf.getR2Bucket('FILES')},call:(path,body,headers)=>tlsCall(identity,origin+path,body,headers),
  async migrate(){const db=await mf.getD1Database('DB');for(const migration of await readD1Migrations(resolve('migrations/core')))await db.batch(migration.queries.map(sql=>db.prepare(sql)))},
  async owner(){const response=await tlsCall(identity,origin+'/auth/bootstrap',{token:'synthetic-test-bootstrap-token-at-least-32-characters',displayName:'Owner',returnTo:'/app'});if(response.status!==303)throw new Error('test_native_bootstrap_failed');return response.headers['set-cookie'][0].split(';')[0]},
  async restart(){await mf.dispose();mf=undefined;await start()},async stop(){await mf?.dispose();mf=undefined},
 }
}
