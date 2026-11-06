import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
const root=process.cwd(),load=path=>import(pathToFileURL(root+'/'+path))
const {startBrowserRuntime}=await load('tests/browser/base-runtime.mjs')
const {trackerCreateEdge}=await load('tests/browser/integration-tracker-edge.mjs')
const edge=await trackerCreateEdge(),runtime=await startBrowserRuntime({networkWorker:edge.worker,networkBinding:'PENNY_EGRESS'})
try{
 const bootstrap=await fetch(runtime.origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:runtime.origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Owner',returnTo:'/app'})})
 assert.equal(bootstrap.status,303)
 const cookie=bootstrap.headers.get('set-cookie').split(';')[0],headers={Origin:runtime.origin,Cookie:cookie,'Content-Type':'application/json'}
 const post=(path,body)=>fetch(runtime.origin+path,{method:'POST',headers,body:JSON.stringify(body)})
 const action=async(path,body)=>{const response=await post(path,body);assert.ok(response.ok,await response.clone().text());return response.json()}
 await action('/api/operator/boards',{name:'Synthetic feedback',slug:'feedback',visibility:'public'})
 const subject=await action('/api/operator/requests',{title:'Synthetic tracker subject',description:'Private original wording',boardSlug:'feedback'})
 const teamId='461b4065-5ccf-49ae-a432-876d77554e04'
 const connection=await action('/api/operator/integrations/trackers/connections',{name:'Synthetic queued guard',provider:'linear',projectIdentity:teamId,organizationIdentity:'462adcc8-15a5-4802-a438-226f1fd930a6',apiToken:'synthetic-penny-tracker-api-1',signingKey:'synthetic-penny-tracker-signing-material-1'})
 const title='Synthetic entered title',description='Synthetic entered description'
 edge.expected.set('linear',{query:'mutation PennyIssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id title url team { id } } } }',variables:{input:{teamId,title,description}}})
 const command=await action('/api/operator/integrations/trackers/create',{requestId:subject.id,connectionId:connection.id,title,description,operationKey:crypto.randomUUID()})
 const path=`/api/operator/integrations/trackers/commands/${command.id}/reconcile`
 const issue={requestId:subject.id,connectionId:connection.id,externalId:crypto.randomUUID(),url:'https://linear.app/penny/issue/PEN-44/known-outcome'}
 const snapshot=async()=>{
  const result={}
  for(const table of ['penny_tracker_links','penny_tracker_commands','integration_deliveries','integration_attempts','integration_resolutions'])result[table]=(await runtime.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()).results
  return result
 }
 const refuse=async(commandId,state)=>{
  const before=await snapshot(),response=await post(`/api/operator/integrations/trackers/commands/${commandId}/reconcile`,issue)
  assert.equal(response.status,409)
  assert.deepEqual(await snapshot(),before)
  console.log('PROBE INT-005 point-2 '+state+': native reconcile -> 409; complete tracker custody unchanged')
 }
 await refuse(command.id,'queued')
 edge.uncertain(true)
 const paused=edge.pause(),drain=runtime.schedule()
 try{await paused.entered;await refuse(command.id,'sending')}finally{paused.resume();await drain}
 assert.equal(await runtime.db.prepare("SELECT state FROM integration_deliveries WHERE namespace='penny-trackers' AND id=?").bind(command.id).first('state'),'uncertain')
 const first=await action(path,issue),beforeReplay=await snapshot(),again=await action(path,issue)
 assert.equal(first.id,again.id)
 assert.deepEqual(await snapshot(),beforeReplay)
 assert.equal(await runtime.db.prepare("SELECT count(*) n FROM integration_resolutions WHERE namespace='penny-trackers' AND delivery_id=?").bind(command.id).first('n'),1)
 await runtime.restart();await runtime.schedule();await runtime.schedule()
 assert.equal(edge.calls.length,1)
 assert.deepEqual(await snapshot(),beforeReplay)
 console.log('PROBE INT-005 point-2 uncertain: native known-issue reconciliation -> accepted; identical replay retains original link and one resolution; real restart and two scheduler drains add zero creates')
 const rejected=await action('/api/operator/integrations/trackers/create',{requestId:subject.id,connectionId:connection.id,title,description,operationKey:crypto.randomUUID()})
 edge.reject(true)
 try{await runtime.schedule()}finally{edge.reject(false)}
 await refuse(rejected.id,'rejected')
 const rejectedState=await snapshot()
 await runtime.restart();await runtime.schedule();await runtime.schedule()
 assert.equal(edge.calls.length,2)
 assert.deepEqual(await snapshot(),rejectedState)
 console.log('PROBE_RESULT '+JSON.stringify({head:process.env.PROBE_HEAD,exit:0,queued:409,sending:409,rejected:409,uncertainResolution:'accepted',sameLinkReplay:true,resolutions:1,additionalCreatesAfterReconciliation:0,providerHttpFakeOnly:true,teardown:'fulfilled'}))

}finally{await runtime.close()}
