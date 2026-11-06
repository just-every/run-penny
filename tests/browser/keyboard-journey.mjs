import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {expect} from '@playwright/test'
import {requesterAuth} from './requester-auth.mjs'
import {shot,manifest,output} from './requester-evidence.mjs'
import {seedOverviewAttention} from './operator-pages-data.mjs'
import {keyboardControls} from './keyboard-controls.mjs'

/** Extend the existing requester sanity journey with its native keyboard paths. */
export async function proveKeyboardJourney(browser){
const errors=[],checks=[]
let runtime
try{
 const harness=await requesterAuth(browser);runtime=harness.runtime
 const {origin,api}=harness
 const activity=token=>api('/api/public/requester/activity',undefined,{Authorization:`Bearer ${token}`}).then(response=>response.json())
 const setup=await harness.operator(1440)
 await seedOverviewAttention(runtime.db)
 await api('/api/operator/boards',{name:'Keyboard feedback',slug:'keyboard',visibility:'public'},setup.page.request)
 await harness.explicitConsentBoard('keyboard',setup.page.request)
 const approved=await (await api('/api/operator/requests',{title:'Schedule a finance export',description:'Finance needs a monthly CSV.',boardSlug:'keyboard'},setup.page.request)).json()
 await api(`/api/operator/moderation/${approved.slug}`,{verdict:'approved',title:'Schedule a finance export',description:'Finance needs a monthly CSV.',boardSlug:'keyboard',displayName:'Operator'},setup.page.request)
 await setup.context.close()
 for(const width of [1440,390]){
  const person=await harness.requester(width,[`synthetic-penny-${width}`,'example.test'].join('@'))
  const operator=await harness.operator(width),page=person.page,review=operator.page
  for(const target of [page,review]){target.setDefaultTimeout(20000);target.on('pageerror',error=>errors.push(error.message))}
  try{
   // Sign-in and fixture preparation finish before the keyboard measurements begin.
   await page.goto(origin+'/portal/feedback/new')
   await expect(page.getByRole('button',{name:'Send for review',exact:true})).toBeEnabled()
   const title=`Keyboard report ${width}`,description='Customers need a reliable monthly report.'
   let keys=await keyboardControls(page)
   await keys.type(page.getByLabel('Title',{exact:true}),title,'submission title')
   await keys.type(page.getByLabel('Problem description',{exact:true}),description,'submission problem')
   await keys.choose(page.locator('select[name=board]'),'keyboard','submission board')
   const submitted=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/public/requests'&&response.request().method()==='POST')
   await keys.activate(page.getByRole('button',{name:'Send for review',exact:true}),'submit held request')
   const response=await submitted;assert.equal(response.status(),201)
   const created=await response.json()
   await page.getByRole('heading',{name:'Feedback is awaiting review',exact:true}).waitFor()
   const submissionInput=await keys.finish()
   const held=(await activity(person.token)).requests.find(request=>request.slug===created.slug)
   assert.ok(held?.id,'the submitted identity appears in the requester activity')
   assert.equal(held.title,title);assert.equal(held.description,description)
   assert.equal(held.moderationState,'awaiting_review');assert.equal(held.publicState,'unpublished')
   assert.notEqual(held.id,approved.id,'the vote target is separately approved')
   const privateRead=await person.page.request.get(origin+`/api/public/requests/${held.slug}`)
   assert.equal(privateRead.status(),404,'held wording remains private')
   await shot(page,'keyboard-submitted',width)

   await page.goto(origin+`/portal/feedback/${approved.slug}`)
   const participation=page.getByRole('region',{name:'Participate in feedback',exact:true})
   const vote=participation.getByRole('button',{name:'Vote',exact:true})
   await expect(vote).toBeEnabled()
   assert.equal((await activity(person.token)).votes.some(row=>row.slug===approved.slug),false)
   const before=await (await api(`/api/public/requests/${approved.slug}`)).json()
   keys=await keyboardControls(page)
   const voted=page.waitForResponse(response=>new URL(response.url()).pathname===`/api/public/requests/${approved.slug}/vote`&&response.request().method()==='POST')
   await keys.activate(vote,'vote on approved request','Space')
   assert.equal((await voted).status(),204)
   await participation.getByText('Vote saved.',{exact:true}).waitFor()
   const voteInput=await keys.finish()
   const after=await (await api(`/api/public/requests/${approved.slug}`)).json()
   assert.equal(after.slug,approved.slug);assert.equal(after.voteCount,before.voteCount+1)
   assert.deepEqual((await activity(person.token)).votes.map(row=>({slug:row.slug,available:row.available})).sort((a,b)=>a.slug.localeCompare(b.slug)),[{slug:held.slug,available:0},{slug:approved.slug,available:1}].sort((a,b)=>a.slug.localeCompare(b.slug)))
   await page.reload()
   await expect(participation.getByRole('button',{name:'Remove vote',exact:true})).toBeEnabled()
   await shot(page,'keyboard-voted',width)

   // Use the existing evidence fixture, initially unlinked to this round's target.
   const evidenceId='attention-evidence',reason=`Matches the finance reporting need at ${width} pixels.`
   await review.goto(origin+'/app/feedback')
   const card=review.locator(`#evidence-${evidenceId}`)
   const links=()=>api(`/api/operator/evidence/${evidenceId}/links`,undefined,review.request).then(response=>response.json())
   assert.deepEqual(await links(),[])
   await card.getByText('Unreviewed',{exact:true}).waitFor()
   keys=await keyboardControls(review)
   await keys.activate(card.getByText('Review and link evidence',{exact:true}),'open evidence controls')
   const form=card.getByRole('form',{name:'Link to request',exact:true})
   await expect(form.getByLabel('Request',{exact:true}).locator(`option[value="${approved.id}"]`)).toHaveCount(1)
   await keys.choose(form.getByLabel('Request',{exact:true}),approved.id,'evidence request')
   const linked=review.waitForResponse(response=>new URL(response.url()).pathname===`/api/operator/evidence/${evidenceId}/links`&&response.request().method()==='PUT')
   await keys.activate(form.getByRole('button',{name:'Save',exact:true}),'save evidence link')
   assert.equal((await linked).status(),200)
   await expect(form.getByRole('status')).toHaveText('Saved.')
   assert.deepEqual(await links(),[{target:'request',targetId:approved.id,label:'Schedule a finance export',stance:'supporting'}])
   await card.getByText('Unreviewed',{exact:true}).waitFor()
   const verdict=card.getByRole('form',{name:'Mark reviewed',exact:true})
   await keys.type(verdict.getByLabel('Review reason',{exact:true}),reason,'evidence review reason')
   const reviewed=review.waitForResponse(response=>new URL(response.url()).pathname===`/api/operator/evidence/${evidenceId}/review`&&response.request().method()==='POST')
   await keys.activate(verdict.getByRole('button',{name:'Save',exact:true}),'review linked evidence')
   assert.equal((await reviewed).status(),200)
   await card.getByText('Reviewed',{exact:true}).waitFor()
   const triageInput=await keys.finish()
   const readEvidence=async()=>{
    const items=await (await api('/api/operator/evidence',undefined,review.request)).json()
    const item=items.items.find(item=>item.id===evidenceId)
    assert.ok(item);assert.equal(item.reviewState,'reviewed');assert.equal(item.reviewReason,reason)
    assert.equal(item.wording,'Customers need a clear delivery promise.')
    assert.deepEqual(await links(),[{target:'request',targetId:approved.id,label:'Schedule a finance export',stance:'supporting'}])
    return item
   }
   await readEvidence();await review.reload()
   await card.getByText('Reviewed',{exact:true}).waitFor();await card.getByText(reason,{exact:true}).waitFor()
   await readEvidence()
   const reloadKeys=await keyboardControls(review)
   await reloadKeys.activate(card.getByText('Review and link evidence',{exact:true}),'reopen persisted evidence links')
   await card.getByRole('form',{name:'Schedule a finance export · supporting',exact:true}).waitFor()
   const reloadInput=await reloadKeys.finish()
   await shot(review,'keyboard-triaged',width)
   assert.equal((await activity(person.token)).requests.find(request=>request.id===held.id).moderationState,'awaiting_review')
   checks.push({width,heldRequest:held.id,votedRequest:approved.id,evidence:evidenceId,reason,submissionInput,voteInput,triageInput,reloadInput})
   console.log(`PROBE A11Y-001 point 2 ${width}px: native keyboard submit, vote, link and reasoned review -> held request ${held.id}, approved request ${approved.id}, evidence ${evidenceId}; persisted after reload; zero pointer events and focus calls`)
   // Reset only fixture state between the two independent keyboard journeys.
   await api(`/api/operator/evidence/${evidenceId}/review`,{reviewed:false},review.request)
   await api(`/api/operator/evidence/${evidenceId}/links`,{target:'request',targetId:approved.id},review.request,'DELETE')
  }finally{await person.context.close();await operator.context.close()}
 }
 harness.assertNoRateLimits();harness.assertNoBrowserDiagnostics()
 await manifest('keyboard-receipt',errors,checks,origin)
}catch(error){
 await mkdir(output,{recursive:true})
 for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:`${output}/failure-${page.viewportSize().width}-${browser.contexts().indexOf(context)}.png`,fullPage:true})
 throw error
}finally{await runtime?.close()}
}
