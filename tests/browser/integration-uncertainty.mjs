import assert from 'node:assert/strict'

export function uncertaintyEdge(){
 const calls=[]
 const worker={name:'integration-egress-edge',modules:true,compatibilityDate:'2026-08-31',script:`
 import {WorkerEntrypoint} from 'cloudflare:workers';
 export default class extends WorkerEntrypoint{
  async send(wire){
   if(wire.url!=='https://events.example.com/penny'||!wire.headers['webhook-id']||JSON.parse(wire.body).event!=='status.published')throw Error('Unexpected synthetic integration wire');
   const response=await fetch(wire.url,{method:'POST',headers:wire.headers,body:wire.body,redirect:'manual'});
   return {status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()};
  }
 }`,outboundService:async request=>{
  assert.equal(request.url,'https://events.example.com/penny')
  assert.equal(request.method,'POST')
  calls.push({id:request.headers.get('webhook-id'),body:await request.json()})
  return new Response(null,{status:503})
 }}
 return {worker,calls}
}

export async function checkUncertainty({runtime,page,action,subject,capture,calls}){
 const created=await action('/api/operator/integrations/destinations',{name:'synthetic-penny-public-webhook',kind:'webhook',endpoint:'https://events.example.com/penny',events:['status.published']})
 const read=async()=>(await page.request.get(runtime.origin+'/api/operator/integrations/destinations')).json()
 const records=async()=>(await runtime.db.prepare('SELECT * FROM integration_attempts ORDER BY delivery_id,number').all()).results
 for(const outcome of ['accepted','rejected']){
  await action(`/api/operator/requests/${subject.slug}/status-updates`,{status:'under_review',body:`synthetic-penny-browser-unknown-${outcome}`,idempotencyKey:crypto.randomUUID()})
  await runtime.schedule()
  const held=(await read()).deliveries.find(row=>row.state==='uncertain'),before=await records(),sent=calls.length
  assert.ok(held,'[INT-003] ambiguous network-edge outcome is visibly held')
  assert.equal(calls.at(-1).id,held.id,'[INT-003] wire identity is the durable delivery identity')
  await runtime.restart();await runtime.schedule()
  assert.deepEqual({attempts:await records(),calls:calls.length,state:(await read()).deliveries.find(row=>row.id===held.id)?.state},{attempts:before,calls:sent,state:'uncertain'},'[INT-003] reopened storage retains attempt identity and refuses ambiguous resend')
  await page.goto(runtime.origin+'/app/settings');await page.waitForLoadState('networkidle')
  const receipt=page.locator('li').filter({hasText:held.id}).filter({has:page.getByRole('button',{name:'Reconcile receipt',exact:true})})
  await receipt.getByRole('combobox',{name:'Confirmed outcome',exact:true}).selectOption(outcome)
  await receipt.getByLabel('Receipt evidence code',{exact:true}).fill('synthetic_known_receipt')
  await capture(`uncertain-${outcome}`,page.locator('#destinations-heading'))
  await receipt.getByRole('button',{name:'Reconcile receipt',exact:true}).click()
  await page.getByRole('status').filter({hasText:'Receipt reconciled.'}).waitFor()
  assert.equal((await read()).deliveries.find(row=>row.id===held.id)?.state,outcome,'[INT-003] explicit known receipt resolves the held effect')
  await runtime.restart();await runtime.schedule();await page.reload();await page.waitForLoadState('networkidle')
  assert.deepEqual({calls:calls.length,resolutions:await runtime.db.prepare('SELECT count(*) n FROM integration_resolutions WHERE delivery_id=?').bind(held.id).first('n'),state:(await read()).deliveries.find(row=>row.id===held.id)?.state},{calls:sent,resolutions:1,state:outcome},'[INT-003] terminal reconciliation survives another restart without resend')
  assert.equal(await page.getByRole('button',{name:'Reconcile receipt',exact:true}).count(),0,'[INT-003] resolved receipts cannot be reconciled again')
  await capture(`reconciled-${outcome}`,page.locator('#destinations-heading'))
 }
 const before=calls.length
 await action(`/api/operator/requests/${subject.slug}/status-updates`,{status:'planned',body:'synthetic-penny-revoked-before-send',idempotencyKey:crypto.randomUUID()})
 const revoked=await page.request.delete(runtime.origin+`/api/operator/integrations/destinations/${created.id}`,{headers:{Origin:runtime.origin}})
 assert.equal(revoked.status(),200)
 await runtime.restart();await runtime.schedule()
 assert.equal(calls.length,before,'[INT-003] revoked configuration starts zero sends after restart')
 return 5
}
