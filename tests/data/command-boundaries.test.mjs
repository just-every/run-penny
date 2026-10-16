import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm,writeFile,chmod,symlink,link,stat,realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {dataOrigin,dataOptions} from '../../scripts/data/options.mjs'
import {privateSession,privateInput,privateWrite,privateDestination} from '../../scripts/data/private-files.mjs'
import {dataTransport} from '../../scripts/data/transport.mjs'
const cookie='__Host-operator_session=synthetic-test-session-capability'
const json=(path,value)=>writeFile(path,JSON.stringify(value),{mode:0o600})
test('[DATA-001 BASE-SECRET-002] explicit origin and session-file options reject credentials, insecure/ambiguous origins and cookie argv',()=>{
 for(const value of ['https://penny.example','http://localhost:15300','http://127.0.0.1:1234'])assert.ok(dataOrigin(value))
 for(const value of ['http://penny.example','https://user:password@penny.example','https://penny.example/#token','https://penny.example/?token=value','https://penny.example/api','file:///private'])assert.throws(()=>dataOrigin(value),/data_origin/)
 for(const argv of [[],['export','archive','--cookie',cookie],['export','archive','--origin','https://penny.example'],['export','archive','--origin','https://penny.example','--origin','https://other.example','--session-file','session']])assert.throws(()=>dataOptions(argv))
})
test('[DATA-001 BASE-SECRET-002] owner-only regular session/archive files refuse mode, symlink, hard-link and parent hazards',async()=>{
 const dir=await mkdtemp(join(await realpath(tmpdir()),'penny-data-boundaries-'))
 try{
  const session=join(dir,'session.json');await json(session,{cookie});assert.ok(await privateSession(session))
  await chmod(session,0o644);await assert.rejects(privateSession(session));await chmod(session,0o600)
  await symlink(session,join(dir,'symlink'));await assert.rejects(privateSession(join(dir,'symlink')))
  await link(session,join(dir,'hardlink'));await assert.rejects(privateSession(session));await rm(join(dir,'hardlink'))
  await json(join(dir,'invalid'),{cookie,extra:true});await assert.rejects(privateSession(join(dir,'invalid')))
  await symlink(dir,join(dir,'linked-parent'));await assert.rejects(privateWrite(join(dir,'linked-parent','archive'),{}))
  const archive=join(dir,'private','archive.json');await privateWrite(archive,{value:'private archive'});assert.equal((await stat(archive)).mode&0o777,0o600);assert.equal((await stat(join(dir,'private'))).mode&0o777,0o700)
  await assert.rejects(privateWrite(archive,{}));await privateWrite(archive,{revision:2},true);assert.deepEqual(await privateInput(archive),{revision:2})
  await symlink(archive,join(dir,'destination-link'));await assert.rejects(privateDestination(join(dir,'destination-link'),true))
  await json(join(dir,'oversize'),{data:'x'.repeat(100)});await assert.rejects(privateInput(join(dir,'oversize'),20))
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('[DATA-001 BASE-SECRET-002] transport sets exact write Origin, refuses redirects/oversized/non-JSON responses and never exposes session errors',async()=>{
 const dir=await mkdtemp(join(await realpath(tmpdir()),'penny-data-transport-')),original=globalThis.fetch
 try{
  const session=join(dir,'session.json');await json(session,{cookie});const request=await dataTransport('https://penny.example',session)
  let calls=0
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(url.origin,'https://penny.example');assert.equal(options.redirect,'error');assert.equal(options.headers.Origin,'https://penny.example');assert.ok(options.headers.Cookie===cookie);return Response.json({status:'complete'})}
  assert.deepEqual(await request('import',{archive:{},journal:{}}),{status:'complete'});assert.equal(calls,1)
  globalThis.fetch=async()=>new Response('server diagnostic containing '+cookie,{status:401})
  await assert.rejects(request('export'),error=>error.code==='data_request_failed_401'&&!error.message.includes(cookie))
  globalThis.fetch=async()=>{throw new Error('redirect containing '+cookie)}
  await assert.rejects(request('export'),error=>error.code==='data_transport_failed'&&!error.message.includes(cookie))
  globalThis.fetch=async()=>new Response('not-json',{headers:{'content-type':'text/html'}})
  await assert.rejects(request('export'),/invalid_data_response/)
  globalThis.fetch=async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(34*1024*1024));controller.close()}}),{headers:{'content-type':'application/json'}})
  await assert.rejects(request('export'),/data_response_limit/)
  await assert.rejects(request('import',{data:'x'.repeat(33*1024*1024)}),/data_request_limit/)
 }finally{globalThis.fetch=original;await rm(dir,{recursive:true,force:true})}
})
