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
}
