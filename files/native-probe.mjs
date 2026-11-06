import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {startBrowserRuntime} from '/workspace/run-penny/tests/browser/base-runtime.mjs'
import {trackerCreateEdge} from '/workspace/run-penny/tests/browser/integration-tracker-edge.mjs'
const mode=process.argv[2],output=process.argv[3],edge=await trackerCreateEdge()
const runtime=await startBrowserRuntime({networkWorker:edge.worker,networkBinding:'PENNY_EGRESS'})
const result={mode,door:'native tracker routes and scheduled Worker',observations:[]}
try{
 const bootstrap=await fetch(runtime.origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:runtime.origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Owner',returnTo:'/app'})})
 assert.equal(bootstrap.status,303)
 const cookie=bootstrap.headers.get('set-cookie').split(';')[0],headers={Origin:runtime.origin,Cookie:cookie,'Content-Type':'application/json'}
 const post=(path,body)=>fetch(runtime.origin+path,{method:'POST',headers,body:JSON.stringify(body)})
 const action=async(path,body)=>{const response=await post(path,body);assert.ok(response.ok,path+' status '+response.status);return response.json()}
 await action('/api/operator/boards',{name:'Product feedback',slug:'feedback',visibility:'public'})
 const subject=await action('/api/operator/requests',{title:'Synthetic tracker subject',description:'Synthetic private original',boardSlug:'feedback'})
 const teamId='461b4065-5ccf-49ae-a432-876d77554e04',organizationId='462adcc8-15a5-4802-a438-226f1fd930a6'
 const connection=await action('/api/operator/integrations/trackers/connections',{name:'Synthetic Linear admission',provider:'linear',projectIdentity:teamId,organizationIdentity:organizationId,apiToken:'synthetic-penny-tracker-api-1',signingKey:'synthetic-penny-tracker-signing-material-1'})
 const title='Entered synthetic title',description='Entered synthetic public wording'
 edge.expected.set('linear',{query:'mutation PennyIssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id title url team { id } } } }',variables:{input:{teamId,title,description}}})
 const command=await action('/api/operator/integrations/trackers/create',{requestId:subject.id,connectionId:connection.id,title,description,operationKey:crypto.randomUUID()})
 const known={requestId:subject.id,connectionId:connection.id,externalId:crypto.randomUUID(),url:'https://linear.app/penny/issue/PEN-44/known-outcome'}
 const snapshot=async()=>{const value={};for(const table of ['penny_tracker_links','penny_tracker_commands','integration_deliveries','integration_attempts','integration_resolutions'])value[table]=(await runtime.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()).results;return value}
 const state=()=>runtime.db.prepare("SELECT state FROM integration_deliveries WHERE namespace='penny-trackers' AND id=?").bind(command.id).first('state')
 const before=await snapshot(),response=await post(`/api/operator/integrations/trackers/commands/${command.id}/reconcile`,known)
 const status=response.status,body=await response.json(),queued=await state(),after=await snapshot()
 result.observations.push({step:'queued reconciliation',status,state:queued,linkAdded:after.penny_tracker_links.length-before.penny_tracker_links.length,unchanged:JSON.stringify(after)===JSON.stringify(before)})
 if(mode==='main'){
  assert.equal(status,200);assert.equal(queued,'queued');assert.equal(after.penny_tracker_links.length,1)
  await runtime.restart();await runtime.schedule()
  assert.equal(edge.calls.filter(call=>call.id===command.id).length,1,'Queued delivery still creates after premature reconciliation')
  result.observations.push({step:'restart and drain',additionalCreates:1,state:await state(),originalLinkRetained:body.id===await runtime.db.prepare('SELECT link_id FROM penny_tracker_commands WHERE id=?').bind(command.id).first('link_id')})
 }else{
  assert.equal(status,409);assert.deepEqual(after,before)
  edge.uncertain(true);await runtime.schedule();assert.equal(await state(),'uncertain')
  const accepted=await action(`/api/operator/integrations/trackers/commands/${command.id}/reconcile`,known),settled=await snapshot()
  const repeat=await action(`/api/operator/integrations/trackers/commands/${command.id}/reconcile`,known)
  assert.equal(repeat.id,accepted.id);assert.equal(repeat.repeat,true);assert.deepEqual(await snapshot(),settled)
  await runtime.restart();await runtime.schedule();await runtime.schedule()
  assert.equal(edge.calls.filter(call=>call.id===command.id).length,1);assert.deepEqual(await snapshot(),settled)
  const read=await fetch(runtime.origin+'/api/operator/integrations/trackers',{headers:{Cookie:cookie}});assert.equal(read.status,200)
  const data=await read.json();assert.equal(data.commands.find(row=>row.id===command.id).link_id,accepted.id)
  result.observations.push({step:'uncertain reconcile, identical replay, restart and repeated drain',state:await state(),sameLink:repeat.id===accepted.id,resolutions:settled.integration_resolutions.length,additionalCreates:0})
 }
 result.passed=true
}finally{await runtime.close();if(output)await writeFile(output,JSON.stringify(result,null,2)+'\n')}
console.log(JSON.stringify(result))
