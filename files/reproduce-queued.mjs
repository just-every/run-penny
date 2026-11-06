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
 const response=await post(path,{requestId:subject.id,connectionId:connection.id,externalId:crypto.randomUUID(),url:'https://linear.app/penny/issue/PEN-44/known-outcome'})
 const link=await response.json(),state=()=>runtime.db.prepare("SELECT state FROM integration_deliveries WHERE namespace='penny-trackers' AND id=?").bind(command.id).first('state')
 const before={status:response.status,delivery:await state(),linked:Boolean(link.id),creates:edge.calls.length}
 await runtime.schedule()
 const after={delivery:await state(),creates:edge.calls.length}
 assert.deepEqual(before,{status:200,delivery:'queued',linked:true,creates:0})
 assert.equal(after.creates,1)
 console.log('REPRODUCED '+JSON.stringify({before,after}))
}finally{await runtime.close()}
