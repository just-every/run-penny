import {askProvider} from '../fixtures/ai/ask-network.ts'
import {mkdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {join} from 'node:path'
import {expect} from '@playwright/test'
/** Extends the existing learning journey; no extra browser process or case. */
export async function draftJourney({page,context,runtime,width,output,axe,expectedRefusal}){
 const origin=runtime.origin
 async function api(path,body,method='POST'){
  const r=body===undefined?await context.request.get(origin+path):await context.request.fetch(origin+path,{method,headers:{Origin:origin},data:body})
  assert.ok(r.ok(),path+' '+r.status()+' '+(r.ok()?'':await r.text()));return r.json()
 }
 async function capture(label,panel){
  await page.evaluate(async()=>{await document.fonts.ready});await panel.scrollIntoViewIfNeeded()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label+' overflow')
  await page.evaluate(axe);assert.deepEqual(await page.evaluate(async()=>(await window.axe.run(document)).violations.filter(v=>['serious','critical'].includes(v.impact))),[],label+' accessibility')
  await panel.evaluate(n=>window.scrollTo(0,Math.max(0,n.getBoundingClientRect().top+window.scrollY-80)))
  await page.screenshot({path:join(output,label+'-top-'+width+'.png')})
  await panel.screenshot({path:join(output,label+'-panel-'+width+'.png')});await page.screenshot({path:join(output,label+'-'+width+'.png'),fullPage:true})
 }
 const operator=await runtime.db.prepare('SELECT id FROM operators LIMIT 1').first()
 await api('/api/operator/settings/ai',{monthlyBudgetMicros:10000000,includePrivate:false,choices:[]},'PUT')
 await api('/api/operator/boards',{name:'Product reporting',slug:'reporting',visibility:'public'})
 const account=await api('/api/operator/accounts',{name:'Northstar Labs',internalOwnerId:operator.id,revenueCents:4800000,health:'Renewal discussion is internal',renewalDate:'2027-03-15'})
 const request=await api('/api/operator/requests',{title:'Export reports with a date filter',description:'Finance teams need to select a reporting period before downloading CSV reports.',boardSlug:'reporting',evidenceIds:[]})
 await api(`/api/operator/requests/${request.slug}/moderate`,{verdict:'approved'})
 const decision=await api('/api/operator/decisions',{question:'How should report exports handle reporting periods?',ownerOperatorId:operator.id})
 const bet=await api(`/api/operator/decisions/${decision.id}/bets`,{title:'Date-filtered CSV export',summary:'Explore choosing a reporting period before export.'})
 const evidence=await api('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Customer reporting interview',wording:'I download the full report and remove rows manually to prepare a monthly CSV.',observedAt:'2026-10-20T10:00:00Z',accountId:account.id,requestLinks:[{id:request.id,stance:'supporting'}],betLinks:[{id:bet.id,stance:'supporting'}]})
 await api(`/api/operator/requests/${request.slug}/notes`,{body:'Private renewal conversation: discuss the account commitment internally.'})
 const comment=await api(`/api/operator/requests/${request.slug}/comments`,{body:'Could I choose the start and end date before downloading?'})
 const baseline=(await api(`/api/operator/requests/${request.slug}/context`)).comments.length
 const states=[['request',request.id,`/app/moderation?item=${request.id}`],['decision',decision.id,`/app/decisions/${decision.slug}`],['account',account.id,`/app/customers/${account.slug}`],['inbox',evidence.id,`/app/feedback?item=${evidence.id}`],['comment',comment.id,`/app/moderation?item=${request.id}`]]
 for(const [kind,id,path] of states){
  await page.goto(origin+path);await page.waitForLoadState('networkidle')
  const panel=page.locator(`[data-draft-kind="${kind}"][data-draft-id="${id}"]`);await panel.locator('summary').click()
  await panel.getByRole('button',{name:kind==='inbox'||kind==='comment'?'Draft reply':'Draft summary',exact:true}).click()
  await expect(panel.getByRole('textbox',{name:kind==='inbox'||kind==='comment'?'Edit reply':'Edit summary',exact:true})).not.toHaveValue('')
  await expect(panel.getByText(/unresolvable citation/)).toBeVisible()
  const links=panel.getByRole('link');assert.ok(await links.count()>0)
  assert.equal((await api(`/api/operator/requests/${request.slug}/context`)).comments.length,baseline,'draft generation never sends')
  await capture('draft-'+kind,panel)
  if(kind==='comment'){
   await expect(panel.getByRole('alert')).toContainText('Account name')
   expectedRefusal(true);await panel.getByRole('button',{name:'Post public reply',exact:true}).click();await expect(panel.getByRole('status').filter({hasText:'private account value'})).toBeVisible();expectedRefusal(false)
   await capture('draft-private-refused',panel)
   const edited='Thank you for explaining the reporting workflow. We are reviewing date-filtered CSV exports; no delivery date is committed.'
   await panel.getByRole('textbox',{name:'Edit reply',exact:true}).fill(edited);await capture('draft-edited',panel)
   await panel.getByRole('button',{name:'Post public reply',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Reply posted')
   assert.equal((await api(`/api/operator/requests/${request.slug}/context`)).comments.length,baseline+1)
   await capture('draft-posted',panel)
   await page.goto(origin+'/portal/feedback/'+request.slug);await expect(page.getByText(edited,{exact:true})).toBeVisible();assert.doesNotMatch(await page.locator('body').innerText(),/Northstar Labs|4800000|Private renewal conversation/)
   await page.screenshot({path:join(output,'draft-public-reply-'+width+'.png'),fullPage:true})
  }
 }
 // AI-009 extends the same public-door journey; no new registered case.
 await mkdir(join(output,'ai-ask'),{recursive:true})
 await runtime.configure({}, {worker:askProvider})
 await runtime.db.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,created_at) VALUES(?,'synthetic-penny-owner@example.test','Fixture owner','owner','active',?)").bind(crypto.randomUUID(),Date.now()).run()
 await runtime.db.prepare("UPDATE oa_operators SET role='member' WHERE email='owner@penny.invalid'").run()
 await page.goto(origin+'/app/ask');await page.waitForLoadState('networkidle')
 const ask=page.getByRole('region',{name:'Ask Penny',exact:true})
 await capture('ai-ask/empty',ask)
 await ask.getByRole('textbox',{name:'Your question',exact:true}).fill('What does the report export evidence say about CSV date filters?')
 await ask.getByRole('button',{name:'Ask Penny',exact:true}).click()
 await expect(ask.getByRole('article',{name:'Penny’s answer',exact:true})).toBeVisible()
 await expect(ask.getByText(/unresolvable citation/)).toBeVisible()
 assert.doesNotMatch(await ask.innerText(),/4800000|48,000|Renewal discussion is internal/)
 assert.equal((await api(`/api/operator/requests/${request.slug}/context`)).comments.length,baseline+1)
 assert.equal(await runtime.db.prepare("SELECT count(*) n FROM integration_deliveries WHERE namespace='penny-ask'").first('n'),0)
 const saved=await runtime.db.prepare('SELECT id FROM penny_ai_answers ORDER BY created_at DESC LIMIT 1').first()
 await capture('ai-ask/answer',ask)
 await page.reload();await expect(ask.getByRole('article',{name:'Penny’s answer',exact:true})).toBeVisible()
 await capture('ai-ask/saved',ask)
 await runtime.db.prepare("UPDATE oa_operators SET role='owner'").run()
 await runtime.configure({}, {worker:askProvider,binding:'PENNY_EGRESS'})
 const destinations=[]
 for(const [name,endpoint] of [['Product feedback','https://hooks.slack.com/services/synthetic-penny-1/synthetic-penny-2/synthetic-penny-3'],['Customer success','https://hooks.slack.com/services/synthetic-penny-4/synthetic-penny-5/synthetic-penny-6']])destinations.push(await api('/api/operator/integrations/destinations',{name,kind:'slack',endpoint,events:['status.published']}))
 await page.reload();await expect(ask.getByRole('article',{name:'Penny’s answer',exact:true})).toBeVisible()
 await ask.getByText('Share to Slack',{exact:true}).click()
 await expect(ask.getByRole('button',{name:'Post answer to Slack',exact:true})).toBeDisabled()
 await ask.getByLabel('Slack destination',{exact:true}).selectOption(destinations[0].id)
 await capture('ai-ask/chosen',ask)
 await ask.getByRole('button',{name:'Post answer to Slack',exact:true}).click()
 await expect(ask.getByRole('status').filter({hasText:'Posted to Product feedback.'})).toBeVisible()
 const deliveries=(await runtime.db.prepare("SELECT destination_id,state FROM integration_deliveries WHERE namespace='penny-ask'").all()).results
 assert.deepEqual(deliveries,[{destination_id:destinations[0].id,state:'accepted'}])
 await capture('ai-ask/posted',ask)
 await runtime.configure({}, {worker:askProvider,binding:'PENNY_LEARNING_EGRESS'})
 await api('/api/operator/settings/ai',{monthlyBudgetMicros:0,includePrivate:false,choices:[]},'PUT')
 expectedRefusal(true);await ask.getByRole('button',{name:'Ask Penny',exact:true}).click()
 await expect(ask.getByRole('alert')).toContainText('monthly AI budget')
 await capture('ai-ask/budget-refused',ask);expectedRefusal(false)
 await runtime.configure({PENNY_AI:''})
 expectedRefusal(true);await ask.getByRole('button',{name:'Ask Penny',exact:true}).click()
 await expect(ask.getByRole('alert')).toContainText('configure')
 await capture('ai-ask/unconfigured',ask);expectedRefusal(false)
 assert.ok(saved.id)

}
