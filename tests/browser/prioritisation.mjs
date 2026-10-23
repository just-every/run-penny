import assert from 'node:assert/strict'
import {moderationJourney} from './moderation-runtime.mjs'
await moderationJourney('prioritisation',async({runtime,origin,operator,json,send,person,pageFor,capture})=>{
 const customer=await person('eli@example.test','Eli Wong'),auth={Authorization:`Bearer ${customer.token}`},requests=[]
 for(const title of ['Schedule monthly finance exports','Send department summaries','Export invoices']){
  const request=await json('/api/public/requests',{title,description:'Finance needs reliable reports for its monthly account reviews.',boardSlug:'finance',idempotencyKey:crypto.randomUUID()},auth,'POST',201)
  await json(`/api/operator/moderation/${request.slug}`,{verdict:'approved',title,description:'Reliable monthly reports for finance.',boardSlug:'finance',displayName:'Eli Wong'},operator)
  requests.push({...request,id:await runtime.db.prepare('SELECT id FROM requests WHERE slug=?').bind(request.slug).first('id')})
 }
 await json('/api/operator/boards/finance/vote-importance',{enabled:true,labels:['Nice to have','Important','Must have']},operator,'PUT')
 const voter=await person('sam@example.test','Sam Rivera')
 await send(`/api/public/requests/${requests[0].slug}/vote`,{importance:3},{Authorization:`Bearer ${voter.token}`},'POST',204)
 const product=await json('/api/operator/hierarchy/product',{name:'Harbor platform'},operator,'POST',201),component=await json('/api/operator/hierarchy/component',{name:'Finance workflows',parentId:product.id},operator,'POST',201),features=[]
 for(const [index,name] of ['Scheduled reporting','Department exports'].entries()){
  const feature=await json('/api/operator/hierarchy/feature',{name,parentId:component.id},operator,'POST',201);features.push({...feature,name})
  await json(`/api/operator/hierarchy/feature/${feature.id}/link`,{kind:'request',targetId:requests[index].id,linked:true},operator,'PUT')
 }
 const owner=await pageFor({cookie:operator.Cookie});await owner.goto(origin+'/app/prioritisation',{waitUntil:'networkidle'})
 await capture(owner,'empty-comparisons')
 await owner.locator('summary').filter({hasText:/^Create comparison$/}).click()
 const form=owner.getByRole('form',{name:'Create comparison',exact:true})
 await form.getByLabel('View name',{exact:true}).fill('Finance priorities')
 await form.getByLabel('Compare',{exact:true}).selectOption('features')
 await form.getByLabel('Sorting formula',{exact:true}).selectOption('rice')
 await form.getByLabel('Share with all operators (only you can edit)').check()
 await form.locator('summary').filter({hasText:'Per-row manual inputs'}).click()
 for(const [index,impact,confidence,effort] of [[0,3,80,2],[1,8,50,1]]){
  const row=form.getByRole('group',{name:features[index].name,exact:true})
  await row.getByLabel('Impact (0–10)',{exact:true}).fill(String(impact));await row.getByLabel('Confidence (%)',{exact:true}).fill(String(confidence));await row.getByLabel('Manual effort',{exact:true}).fill(String(effort))
 }
 await capture(owner,'rice-inputs')
 await form.getByRole('button',{name:'Save comparison',exact:true}).click();await form.getByRole('status').waitFor()
 await owner.getByRole('link',{name:'Finance priorities',exact:true}).click()
 const region=owner.getByRole('region',{name:'Finance priorities',exact:true}),ranked=region.getByRole('list',{name:'Ranked comparison',exact:true})
 await ranked.getByRole('heading',{name:'1. Department exports',exact:true}).waitFor()
 for(const summary of await ranked.locator('summary').all())await summary.click()
 await capture(owner,'rice-results',region)
 const views=await json('/api/operator/prioritisation',undefined,operator),saved=views.find(v=>v.view.name==='Finance priorities')
 await send('/api/operator/settings/operators',{email:'finance-peer@example.test'},operator,'POST',202)
 const invite=runtime.outbox.findLast(message=>message.email==='finance-peer@example.test').url,token=new URL(invite).searchParams.get('token')
 const confirmed=await send('/auth/confirm',{token},{},'POST',303),peerCookie=confirmed.headers.get('set-cookie').split(';')[0],peer=await pageFor({cookie:peerCookie})
 await peer.goto(origin+`/app/prioritisation?view=${saved.id}`,{waitUntil:'networkidle'})
 await peer.getByRole('heading',{name:'1. Department exports',exact:true}).waitFor()
 assert.equal(await peer.locator('summary').filter({hasText:/^Edit comparison$/}).count(),0)
 await capture(peer,'shared-comparison')
 await region.locator('summary').filter({hasText:/^Edit comparison$/}).click()
 const edit=region.getByRole('form',{name:'Edit comparison',exact:true})
 await edit.getByLabel('Sorting formula',{exact:true}).selectOption('weighted_sum')
 await edit.locator('summary').filter({hasText:'Formula weights'}).click()
 await edit.getByLabel('Reach weight',{exact:true}).fill('0');await edit.getByLabel('Importance level 3 weight',{exact:true}).fill('5')
 await edit.getByRole('button',{name:'Save comparison',exact:true}).click()
 await ranked.getByRole('heading',{name:'1. Scheduled reporting',exact:true}).waitFor()
 await capture(owner,'importance-resorted',region)
 const privateView=await json('/api/operator/prioritisation',{name:'Private finance scenario',entity:'requests',formula:'rice',shared:false},operator,'POST',201)
 await peer.goto(origin+`/app/prioritisation?view=${privateView.id}`,{waitUntil:'networkidle'})
 await peer.getByRole('heading',{name:'Comparison unavailable',exact:true}).waitFor();assert.equal((await peer.content()).includes('Private finance scenario'),false)
 await capture(peer,'private-view-refused')
 await owner.goto(origin+`/app/prioritisation?view=${privateView.id}`,{waitUntil:'networkidle'})
 await owner.getByText('Missing: Impact (0–10), Confidence (%), Manual effort',{exact:true}).first().waitFor()
 await capture(owner,'missing-inputs')
 assert.equal((await fetch(origin+'/api/operator/prioritisation')).status,401)
 for(const path of ['/api/public/requests','/api/public/roadmap','/api/public/releases']){const body=await(await fetch(origin+path)).text();assert.equal(body.includes('Finance priorities'),false);assert.equal(body.includes('"score"'),false)}
})
