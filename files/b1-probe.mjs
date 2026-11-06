import assert from 'node:assert/strict'
import {mkdtemp,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {request} from 'node:https'
import {execFileSync} from 'node:child_process'
import {tlsIdentity,workerRuntime} from '../run-penny/tests/data/tls-runtime.mjs'
const label=process.argv[2],out=process.argv[3],directory=await mkdtemp(join(tmpdir(),'penny-b1-'))
const receipt={label,source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),observations:[]}
let runtime,ip=0
try{
 const identity=await tlsIdentity(directory)
 runtime=await workerRuntime(directory,identity)
 await runtime.migrate()
 const Cookie=await runtime.owner()
 async function call(path,body,method=body===undefined?'GET':'POST',expected=200){
  const result=await new Promise((resolve,reject)=>{
   const req=request(runtime.origin+path,{ca:identity.cert,agent:false,method,headers:{Cookie,Origin:runtime.origin,'CF-Connecting-IP':`192.0.2.${++ip}`,...(body===undefined?{}:{'Content-Type':'application/json'})}},res=>{
    const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,text:Buffer.concat(chunks).toString()}));res.on('error',reject)
   });req.on('error',reject);req.setTimeout(180000,()=>req.destroy(new Error('probe_http_timeout')));req.end(body===undefined?undefined:JSON.stringify(body))
  })
  const value=result.text?JSON.parse(result.text):null
  receipt.observations.push({method,path,status:result.status,body:value})
  if(expected!==null)assert.equal(result.status,expected,JSON.stringify(value))
  return {status:result.status,value}
 }
 await call('/api/operator/boards',{name:'Synthetic B1 board',slug:'synthetic-b1',visibility:'public'},'POST',201)
 const created=(await call('/api/operator/requests',{title:'impact',description:'Synthetic B1 request description',boardSlug:'synthetic-b1'},'POST',201)).value
 const db=await runtime.db(),row=await db.prepare('SELECT id FROM requests WHERE slug=?').bind(created.slug).first()
 const definition={name:'Synthetic B1 scorecard',criteria:[{key:'impact',name:'Customer impact',scale:5,weight:1}]}
 const card=(await call('/api/operator/scorecards',definition,'POST',201)).value,path='/api/operator/scorecards/'+card.id
 await call(`${path}/requests/${row.id}/scores`,{versionId:card.versionId,inputs:{impact:5}},'PUT',204)
 const revised=(await call(path+'/versions',{previousVersionId:card.versionId,definition:{...definition,name:'Retained second version'}},'POST',201)).value
 const currentBefore=(await call(path)).value,historyBefore=(await call(path+'?versionId='+card.versionId)).value
 const root={table:'requests',id:row.id},preview=(await call('/api/operator/data/erasure/preview',root)).value
 assert.equal(preview.blockedCopies.filter(c=>c.table==='penny_scorecard_versions').length,2)
 assert(preview.blockedCopies.every(c=>c.resolvable))
 const erased=await call('/api/operator/data/erasure',{...root,planHash:preview.planHash,copies:preview.blockedCopies.map(c=>({table:c.table,key:c.key,resolution:'redact'}))})
 assert.equal(erased.value.status,'complete')
 const persisted=(await db.prepare('SELECT * FROM penny_scorecard_versions ORDER BY version').all()).results
 receipt.persistedVersions=persisted
 const current=await call(path,undefined,'GET',null),history=await call(path+'?versionId='+card.versionId,undefined,'GET',null),exported=await call('/api/operator/data/export',undefined,'GET',null)
 receipt.summary={erasure:erased.status,current:current.status,history:history.status,export:exported.status,exportError:exported.value?.error??null,criteriaKeys:persisted.map(v=>JSON.parse(v.criteria_json).map(c=>c.key)),criterionNames:persisted.map(v=>JSON.parse(v.criteria_json).map(c=>c.name)),outboundCalls:runtime.outboundCalls}
 if(label==='before'){
  assert.equal(current.status,503);assert.equal(history.status,503);assert.equal(exported.status,409);assert.equal(exported.value.error,'scorecard_archive_invalid')
 }else{
  assert.equal(current.status,200);assert.equal(history.status,200);assert.equal(exported.status,200)
  for(const [after,before] of [[current.value,currentBefore],[history.value,historyBefore]]){
   assert.deepEqual(after.version,{...before.version,criteria:before.version.criteria.map(c=>({...c,name:'Customer [erased]'}))})
   assert.deepEqual(after.rows,[])
  }
  assert.deepEqual(persisted.map(v=>JSON.parse(v.criteria_json)),[[{key:'impact',name:'Customer [erased]',scale:5,weight:1}],[{key:'impact',name:'Customer [erased]',scale:5,weight:1}]])
  assert.equal(exported.value.archive.tables.requests.length,0)
  assert.equal(exported.value.archive.tables.penny_scorecard_scores.length,0)
  assert.deepEqual(exported.value.archive.tables.penny_scorecard_versions,persisted)
 }
 assert.equal(runtime.outboundCalls,0)
 receipt.passed=true
 console.log(JSON.stringify(receipt.summary))
} catch(error){receipt.passed=false;receipt.error=error.stack;throw error}
finally{await runtime?.stop();await rm(directory,{recursive:true,force:true});await writeFile(out,JSON.stringify(receipt,null,2)+'\n')}
