import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {browserOptions} from './browser-options.mjs'
import {startBrowserRuntime} from './base-runtime.mjs'
import {createWebhookProtocol} from '../../base/modules/integrations/core/webhook.ts'
const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/integration-states'),checks=[]
assert.ok(!output.startsWith(resolve('.')+'/'));await mkdir(output,{recursive:true})
const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
const secret='test-only-browser-tracker-signing-material',teamId='461b4065-5ccf-49ae-a432-876d77554e04',organizationId='462adcc8-15a5-4802-a438-226f1fd930a6',externalId='91e7a381-a43e-4d71-95ad-cc1c2b8302ab',linearKey='lin_api_test-only-browser-key'
// Linear's GraphQL API is the network edge: setup lists the workspace's teams with the owner's key.
const linear=async request=>{
 if(request.url!=='https://api.linear.app/graphql'||request.method!=='POST'||request.headers.get('Authorization')!==linearKey)throw new Error('Unexpected provider request')
 return Response.json({data:{organization:{id:organizationId,name:'Penny Labs'},teams:{nodes:[{id:'5c0a4f3e-3f61-4d1b-9a41-0d6f0f9e2c11',name:'Design'},{id:teamId,name:'Product'}]}}})
}
let browser
try{
 browser=await chromium.launch(browserOptions())
 for(const width of [1440,390]){
  const runtime=await startBrowserRuntime({mailService:linear});let context
  try{
   const bootstrap=await fetch(runtime.origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:runtime.origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Owner',returnTo:'/app'})});assert.equal(bootstrap.status,303)
   const cookie=bootstrap.headers.get('set-cookie').split(';')[0],index=cookie.indexOf('='),headers={Origin:runtime.origin,Cookie:cookie,'Content-Type':'application/json'}
   const action=async(path,body)=>{const response=await fetch(runtime.origin+path,{method:'POST',headers,body:JSON.stringify(body)});assert.ok(response.ok,'native setup action admitted');return response.json()}
   await action('/api/operator/boards',{name:'Product feedback',slug:'feedback',visibility:'public'})
   const subject=await action('/api/operator/requests',{title:'Deliberate tracker subject',description:'Private original wording',boardSlug:'feedback'})
   context=await browser.newContext({viewport:{width,height:width===390?844:900}});await context.addCookies([{name:cookie.slice(0,index),value:cookie.slice(index+1),url:runtime.origin}])
   const page=await context.newPage(),errors=[],external=[]
   page.on('pageerror',()=>errors.push('pageerror'));page.on('console',message=>{if(message.type()==='error')errors.push('console.error')});page.on('request',request=>{if(new URL(request.url()).origin!==runtime.origin)external.push(new URL(request.url()).origin)})
   async function capture(label,target){
    assert.equal(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth),false,label+' overflow')
    await page.evaluate(axe);assert.deepEqual(await page.evaluate(async()=>(await window.axe.run(document)).violations.filter(row=>['serious','critical'].includes(row.impact))),[],label+' accessibility')
    assert.ok(!(await page.locator('body').innerText()).includes(secret))
    await target.screenshot({path:join(output,label+'-'+width+'.png'),mask:[page.locator('input[type=password]')]});checks.push({label,width})
   }
   assert.equal((await page.goto(runtime.origin+'/app/settings')).status(),200)
   const destination=page.getByRole('form',{name:'New integration destination',exact:true})
   await destination.getByLabel('Connection name',{exact:true}).fill('Local signed notes');await destination.getByRole('combobox',{name:/^Connection type/}).selectOption('receiver')
   await destination.getByRole('button',{name:'Save connection',exact:true}).click()
   const keyInput=page.getByLabel('New signing key',{exact:true});await keyInput.waitFor();const key=await keyInput.inputValue();assert.equal(await keyInput.getAttribute('type'),'password')
   const destinationId=await runtime.db.prepare("SELECT id FROM penny_integration_destinations WHERE name='Local signed notes'").first('id')
   await capture('signed-receiver-masked',destination.locator('..'))
   const protocol=createWebhookProtocol({resolveDestination:async()=>runtime.origin,signingKey:async()=>new Uint8Array(Buffer.from(key,'hex'))})
   const wire=await protocol.prepare({id:'local-browser-inbound',tenant:'penny-inbound',destinationId,event:'request.note',protocol:'webhook',body:JSON.stringify({requestId:subject.id,note:'Private signed receiver note'})},Date.now())
   for(let repeat=0;repeat<2;repeat++)assert.equal((await fetch(runtime.origin+'/api/integrations/webhooks/'+destinationId,{method:'POST',headers:wire.headers,body:wire.body})).status,200)
   assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_integration_receipts').first('n'),1);await page.getByRole('button',{name:'I saved the signing key',exact:true}).click()
   // The receiver shows its full URL and how to sign, and sends itself a real signed test note.
   await page.getByText('How Local signed notes sends a note',{exact:true}).click()
   await page.getByText(runtime.origin+'/api/integrations/webhooks/'+destinationId,{exact:true}).first().waitFor()
   await page.getByRole('button',{name:'Send a test note',exact:true}).click();await page.getByText(/^Test note received\./).waitFor()
   assert.equal(await runtime.db.prepare('SELECT count(*) n FROM request_notes WHERE request_id=?').bind(subject.id).first('n'),2)
   await capture('signed-receiver-guide',page.getByText('How Local signed notes sends a note',{exact:true}).locator('..'))
   const tracker=page.getByRole('form',{name:'New tracker connection',exact:true})
   await tracker.getByLabel('Tracker name',{exact:true}).fill('Linear local evidence');await tracker.getByLabel('Linear personal API key',{exact:true}).fill(linearKey)
   await tracker.getByRole('button',{name:'List my teams',exact:true}).click();await tracker.getByLabel('Team in Penny Labs',{exact:true}).selectOption({label:'Product'})
   await tracker.getByLabel('Tracker webhook signing secret',{exact:true}).fill(secret);await tracker.getByRole('button',{name:'Save tracker connection',exact:true}).click();await page.getByText('Tracker connection saved. Secrets cannot be read back.',{exact:true}).waitFor()
   await capture('tracker-configured',tracker.locator('..'))
   const connectionId=await runtime.db.prepare("SELECT id FROM penny_tracker_connections WHERE name='Linear local evidence'").first('id'),branding=page.getByRole('form',{name:'Portal branding',exact:true})
   await branding.getByRole('textbox',{name:/^Portal description/}).fill('Feedback for our product, reviewed with care.');await branding.getByLabel('Portal accent',{exact:true}).fill('#173c2b');await branding.getByRole('button',{name:'Save portal branding',exact:true}).click();await page.getByText('Portal branding saved.',{exact:true}).waitFor()
   await page.goto(runtime.origin+'/app/moderation')
   const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Deliberate tracker subject',exact:true})});await card.getByText('Discussion, status and request controls',{exact:true}).click()
   const issueAction=card.getByRole('form',{name:'Tracker issue action',exact:true});await issueAction.getByRole('combobox',{name:/^Tracker connection/}).selectOption(connectionId)
   await issueAction.getByLabel('Stable issue ID',{exact:true}).fill(externalId);await issueAction.getByLabel('HTTPS issue URL',{exact:true}).fill('https://linear.app/penny/issue/PEN-42/owner-approved-issue')
   await issueAction.getByRole('button',{name:'Link tracker issue',exact:true}).click();await card.getByText('Issue linked.',{exact:true}).waitFor();await capture('tracker-linked',issueAction.locator('..'))
   const payload={action:'update',type:'Issue',organizationId,webhookTimestamp:Date.now(),data:{id:externalId,teamId,updatedAt:'2026-10-09T12:30:00.000Z',state:{name:'In Progress'}}},raw=JSON.stringify(payload),signature=createHmac('sha256',secret).update(raw).digest('hex')
   assert.equal((await fetch(runtime.origin+'/api/integrations/trackers/'+connectionId,{method:'POST',headers:{'Linear-Signature':signature,'Linear-Delivery':crypto.randomUUID(),'Linear-Event':'Issue'},body:raw})).status,200)
   await runtime.restart()
   assert.equal((await fetch(runtime.origin+'/api/integrations/trackers/'+connectionId,{method:'POST',headers:{'Linear-Signature':signature,'Linear-Delivery':crypto.randomUUID(),'Linear-Event':'Issue'},body:raw})).status,200)
   assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_tracker_receipts').first('n'),1)
   await page.reload();await card.getByText('Discussion, status and request controls',{exact:true}).click();await card.getByText('In Progress',{exact:false}).first().waitFor();await capture('tracker-received-state',card)
   await issueAction.getByRole('combobox',{name:/^Tracker action/}).selectOption('create');assert.equal(await issueAction.getByRole('button',{name:'Create tracker issue',exact:true}).isDisabled(),true)
   assert.equal(await runtime.db.prepare('SELECT count(*) n FROM request_status_updates').first('n'),0)
   await page.goto(runtime.origin+'/portal/feedback');await page.getByText('Feedback for our product, reviewed with care.',{exact:true}).waitFor();assert.equal(await page.locator('.public-portal').evaluate(node=>getComputedStyle(node).getPropertyValue('--penny-brand-accent')),'#173c2b');await capture('branded-portal',page.locator('.public-portal'))
   assert.equal(await runtime.db.prepare('SELECT count(*) n FROM integration_deliveries').first('n'),0);assert.equal(runtime.outbox.length,0);assert.deepEqual(errors,[]);assert.deepEqual(external,[])
  }finally{await context?.close();await runtime.close()}
 }
 await writeFile(join(output,'results.json'),JSON.stringify({clauses:['INT-002','INT-004','INT-005','INT-006','INT-007'],checks,secretValuesMasked:true,unexpectedErrors:0,externalRequests:0,providerCalls:0,outbound:'configuration-disabled',nativeRuntimeRestarts:2,teardown:'fulfilled'},null,2)+'\n')
 console.log('integration-states: '+checks.length+' captures passed')
}finally{await browser?.close()}
