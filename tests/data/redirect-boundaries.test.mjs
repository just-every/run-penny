import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer as httpsServer} from 'node:https'
import {createServer as httpServer} from 'node:http'
import {spawn} from 'node:child_process'
import {mkdtemp,writeFile,rm,stat,realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {tlsIdentity} from './tls-runtime.mjs'
const listen=server=>new Promise((r,j)=>server.once('error',j).listen(0,'127.0.0.1',()=>r('127.0.0.1:'+server.address().port)))
const close=server=>new Promise(r=>server.close(r))
test('[DATA-001 BASE-SECRET-002] actual TLS rejects untrusted certificates and foreign or downgrade redirects without forwarding owner sessions',async()=>{
 const dir=await mkdtemp(join(await realpath(tmpdir()),'penny-data-redirect-'));const servers=[]
 try{
  const identity=await tlsIdentity(dir);let sourceCalls=0,foreignCalls=0,location
  const foreign=httpsServer(identity,(_request,response)=>{foreignCalls++;response.end('{}')});servers.push(foreign)
  const foreignOrigin='https://'+await listen(foreign)
  const insecure=httpServer((_request,response)=>{foreignCalls++;response.end('{}')});servers.push(insecure)
  const insecureOrigin='http://'+await listen(insecure)
  const source=httpsServer(identity,(_request,response)=>{sourceCalls++;response.writeHead(302,{Location:location});response.end()});servers.push(source)
  const origin='https://'+await listen(source),cookie='__Host-operator_session='+'r'.repeat(40),session=join(dir,'session.json'),output=join(dir,'archive.json')
  await writeFile(session,JSON.stringify({cookie}),{mode:0o600})
  async function run(trusted){
   const environment={...process.env};delete environment.NODE_EXTRA_CA_CERTS
   if(trusted)environment.NODE_EXTRA_CA_CERTS=identity.certificate
   const child=spawn(process.execPath,['scripts/data-command.mjs','export',output,'--origin',origin,'--session-file',session],{env:environment,stdio:['ignore','pipe','pipe']})
   const chunks=[];child.stdout.on('data',b=>chunks.push(b));child.stderr.on('data',b=>chunks.push(b))
   const code=await new Promise((r,j)=>{child.once('error',j);child.once('close',r)})
   assert.equal(code,1);const diagnostic=Buffer.concat(chunks).toString()
   assert.ok(diagnostic.includes('data_transport_failed'));assert.ok(!diagnostic.includes(cookie))
   await assert.rejects(stat(output),error=>error.code==='ENOENT')
  }
  location=foreignOrigin+'/api/operator/data/export';await run(false);assert.equal(sourceCalls,0)
  for(const destination of [foreignOrigin,insecureOrigin,origin]){location=destination+'/api/operator/data/export';await run(true)}
  assert.equal(sourceCalls,3);assert.equal(foreignCalls,0)
 }finally{for(const server of servers.reverse())await close(server);await rm(dir,{recursive:true,force:true})}
})
