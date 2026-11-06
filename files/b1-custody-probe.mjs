import assert from 'node:assert/strict'
import {mkdtemp,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {request} from 'node:https'
import {tlsIdentity,workerRuntime} from '../run-penny/tests/data/tls-runtime.mjs'
const directory=await mkdtemp(join(tmpdir(),'penny-b1-custody-')),receipt={observations:[],refusals:[]}
let runtime,ip=0
try{
 const identity=await tlsIdentity(directory);runtime=await workerRuntime(directory,identity);await runtime.migrate()
 const Cookie=await runtime.owner(),db=await runtime.db()
 async function call(path,body,method=body===undefined?'GET':'POST',expected=200){
  const result=await new Promise((resolve,reject)=>{
   const req=request(runtime.origin+path,{ca:identity.cert,agent:false,method,headers:{Cookie,Origin:runtime.origin,'CF-Connecting-IP':`198.18.0.${++ip}`,...(body===undefined?{}:{'Content-Type':'application/json'})}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,text:Buffer.concat(chunks).toString()}));res.on('error',reject)});req.on('error',reject);req.setTimeout(180000,()=>req.destroy(new Error('probe_timeout')));req.end(body===undefined?undefined:JSON.stringify(body))
  })
  const value=result.text?JSON.parse(result.text):null
  receipt.observations.push({method,path,status:result.status,...(result.status>=400?{body:value}:{})})
  assert.equal(result.status,expected,JSON.stringify(value));return value
 }
 await call('/api/operator/boards',{name:'Synthetic custody',slug:'synthetic-custody',visibility:'public'},'POST',201)
 const makeRequest=title=>call('/api/operator/requests',{title,description:'Details for '+title,boardSlug:'synthetic-custody'},'POST',201)
 const root=await makeRequest('impact'),survivor=await makeRequest('Separate retained request')
 const definition={name:'Retained business card',criteria:[{key:'impact',name:'Customer impact',scale:5,weight:1}]}
 const card=await call('/api/operator/scorecards',definition,'POST',201),path='/api/operator/scorecards/'+card.id
 const score=(request,versionId,value)=>call(`${path}/requests/${request.id}/scores`,{versionId,inputs:{impact:value}},'PUT',204)
 await score(root,card.versionId,4);await score(survivor,card.versionId,3)
 const version=await call(path+'/versions',{previousVersionId:card.versionId,definition:{...definition,name:'Retained current card'}},'POST',201)
 await score(root,version.versionId,2);await score(survivor,version.versionId,5)
 const before={current:await call(path),history:await call(path+'?versionId='+card.versionId)}
 const target={table:'requests',id:root.id},plan=await call('/api/operator/data/erasure/preview',target)
 assert(plan.blockedCopies.every(c=>c.resolvable));assert.equal(plan.blockedCopies.length,2)
 const copies=plan.blockedCopies.map(c=>({table:c.table,key:c.key,resolution:'rename',values:{criteria_json:JSON.stringify(JSON.parse(c.values.criteria_json.current).map(v=>({...v,name:'Reviewed customer benefit'})))}}))
 const snapshot=async()=>JSON.stringify((await db.batch(['penny_scorecard_versions','penny_scorecard_scores','requests','audit_entries','data_state','data_operations'].map(t=>db.prepare(`SELECT * FROM ${t} ORDER BY 1`)))).map(r=>r.results))
 const stable=await snapshot()
 for(const [label,edit] of [
  ['invalid JSON',()=>'{'],['invalid key',c=>({...c,key:'[erased]'})],['different valid key',c=>({...c,key:'different'})],['changed scale',c=>({...c,scale:10})],['changed weight',c=>({...c,weight:2})],['empty criteria',()=>[]],['invalid name',c=>({...c,name:''})],
 ]){
  const changed=structuredClone(copies),parsed=JSON.parse(changed[0].values.criteria_json)
  const value=edit(parsed[0]);changed[0].values.criteria_json=typeof value==='string'?value:JSON.stringify(Array.isArray(value)?value:[value])
  const error=await call('/api/operator/data/erasure',{...target,planHash:plan.planHash,copies:changed},'POST',409)
  assert.equal(error.error,'erasure_scorecard_invalid');assert.equal(await snapshot(),stable);receipt.refusals.push({label,error:error.error,unchanged:true})
 }
 const repeating=structuredClone(copies);repeating[0].values.criteria_json=plan.blockedCopies[0].values.criteria_json.current
 assert.equal((await call('/api/operator/data/erasure',{...target,planHash:plan.planHash,copies:repeating},'POST',409)).error,'erasure_rename_repeats')
 assert.equal(await snapshot(),stable)
 const erased=await call('/api/operator/data/erasure',{...target,planHash:plan.planHash,copies})
 assert.equal(erased.status,'complete')
 for(const [query,original] of [['',before.current],['?versionId='+card.versionId,before.history]]){
  const after=await call(path+query)
  assert.deepEqual(after.version,{...original.version,criteria:original.version.criteria.map(c=>({...c,name:'Reviewed customer benefit'}))})
  assert.equal(after.rows.length,1)
  assert.deepEqual(after.rows[0].scorers,original.rows.find(r=>r.requestId===survivor.id).scorers)
  assert.equal(after.rows[0].weightedResult,original.rows.find(r=>r.requestId===survivor.id).weightedResult)
 }
 const exported=await call('/api/operator/data/export')
 assert.equal(exported.archive.tables.penny_scorecard_scores.length,2)
 assert.equal(exported.archive.tables.penny_scorecard_versions.length,2)
 // Wording that occurs only as a JSON property name is not a personal copy.
 const structural=await makeRequest('scale'),structuralTarget={table:'requests',id:structural.id},structuralPlan=await call('/api/operator/data/erasure/preview',structuralTarget)
 assert.deepEqual(structuralPlan.blockedCopies,[])
 await call('/api/operator/data/erasure',{...structuralTarget,planHash:structuralPlan.planHash})
 await call('/api/operator/data/export')
 receipt.summary={acceptedRename:true,structuralRefusals:receipt.refusals.length,repeatRefused:true,refusalsAtomic:true,survivingCurrentAndHistoryInputsUnchanged:true,exportScoreRows:2,exportVersions:2,propertyOnlyMatchErased:true,outboundCalls:runtime.outboundCalls}
 assert.equal(runtime.outboundCalls,0);receipt.passed=true;console.log(JSON.stringify(receipt.summary))
}catch(error){receipt.passed=false;receipt.error=error.stack;throw error}
finally{await runtime?.stop();await rm(directory,{recursive:true,force:true});await writeFile('../packet/b1-custody.json',JSON.stringify(receipt,null,2)+'\n')}
