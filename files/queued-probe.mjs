import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
const root=process.cwd(),load=path=>import(pathToFileURL(root+'/'+path))
const {startBrowserRuntime}=await load('tests/browser/base-runtime.mjs')
const {trackerCreateEdge}=await load('tests/browser/integration-tracker-edge.mjs')
const edge=await trackerCreateEdge(),runtime=await startBrowserRuntime()
try{
 await runtime.configure({},{worker:edge.worker,binding:'PENNY_EGRESS'})
 const bootstrap=await fetch(runtime.origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:runtime.origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Owner',returnTo:'/app'})})
 assert.equal(bootstrap.status,303)
 const headers={Origin:runtime.origin,Cookie:bootstrap.headers.get('set-cookie').split(';')[0],'Content-Type':'application/json'}
 const action=async(path,body)=>{const r=await fetch(runtime.origin+path,{method:'POST',headers,body:JSON.stringify(body)});assert.ok(r.ok,path+' '+r.status);return r.json()}
 await action('/api/operator/boards',{name:'Product feedback',slug:'feedback',visibility:'public'})
 const subject=await action('/api/operator/requests',{title:'synthetic-penny-queued subject',description:'synthetic-penny-entered description',boardSlug:'feedback'})
 const teamId='461b4065-5ccf-49ae-a432-876d77554e04'
 const connection=await action('/api/operator/integrations/trackers/connections',{name:'synthetic-penny-queued tracker',provider:'linear',projectIdentity:teamId,organizationIdentity:'462adcc8-15a5-4802-a438-226f1fd930a6',apiToken:'synthetic-penny-tracker-1',signingKey:'synthetic-penny-signing-material-1'})
 const title='synthetic-penny-entered title',description='synthetic-penny-entered description'
 edge.expected.set('linear',{query:'mutation PennyIssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id title url team { id } } } }',variables:{input:{teamId,title,description}}})
 const command=await action('/api/operator/integrations/trackers/create',{requestId:subject.id,connectionId:connection.id,title,description,operationKey:crypto.randomUUID()})
 const snapshot=async()=>{const rows={};for(const table of ['penny_tracker_links','penny_tracker_commands','integration_deliveries','integration_attempts','integration_resolutions'])rows[table]=(await runtime.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()).results;return rows}
 const before=await snapshot()
 const response=await fetch(runtime.origin+`/api/operator/integrations/trackers/commands/${command.id}/reconcile`,{method:'POST',headers,body:JSON.stringify({requestId:subject.id,connectionId:connection.id,externalId:crypto.randomUUID(),url:'https://linear.app/penny/issue/PEN-44/known-outcome'})})
 const after=await snapshot()
 if(process.env.PENNY_EXPECT_UNGUARDED==='1'){
  assert.equal(response.status,200)
  assert.equal(after.penny_tracker_links.length,1)
  assert.equal(after.penny_tracker_commands[0].link_id,after.penny_tracker_links[0].id)
  assert.equal(after.integration_deliveries[0].state,'queued')
  await runtime.schedule()
  assert.equal(edge.calls.filter(row=>row.id===command.id).length,1)
  console.log(JSON.stringify({probe:'INT-005 queued known-issue defect',reconcileStatus:response.status,linkedWhileDeliveryQueued:true,additionalCreates:1,reproduced:true}))
 }else{
  assert.equal(response.status,409)
  assert.deepEqual(after,before)
  console.log(JSON.stringify({probe:'INT-005 queued known-issue refusal',reconcileStatus:response.status,custodyUnchanged:true,providerCreates:edge.calls.length,passed:true}))
 }
}finally{await runtime.close()}
