import assert from 'node:assert/strict'
import { boundedStep, form, save, requestTitle } from './loopjourney-steps.mjs'
export async function clauseEvidence(operator,requester,origin,audit,requesterAudit){
 await operator.goto(origin+'/app/customers',{waitUntil:'networkidle'})
 await operator.locator('summary').filter({hasText:/^Create account$/}).click()
 const account=form(operator,'New account')
 await account.getByLabel('Account name',{exact:true}).fill('Onboarding team')
 await account.getByLabel('Internal owner',{exact:true}).selectOption({label:'Owner'})
 await account.getByLabel('Revenue in cents (optional)',{exact:true}).fill('120000')
 await account.getByLabel('Renewal date (optional)',{exact:true}).fill('2027-01-01')
 await account.getByLabel('Health (optional)',{exact:true}).fill('Needs onboarding visibility')
 const saved=await save(operator,account,'Create account','/api/operator/accounts')
 await audit(operator,'EVID-005-account-created')
 await operator.goto(origin+'/app/feedback',{waitUntil:'networkidle'})
 const recorder=form(operator,'New evidence')
 await recorder.getByLabel('Source',{exact:true}).selectOption('interview')
 const originalWording='The team needs onboarding visibility before renewal.'
 await recorder.getByLabel('Original wording',{exact:true}).fill(originalWording)
 const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset())
 await recorder.getByLabel('Observed time',{exact:true}).fill(now.toISOString().slice(0,16))
 await recorder.getByLabel('Existing account (optional)',{exact:true}).selectOption(saved.id)
 await recorder.getByLabel('Find related requests',{exact:true}).fill('onboarding progress')
 const suggested=recorder.getByRole('checkbox',{name:new RegExp(requestTitle)})
 await suggested.waitFor()
 assert.equal(await suggested.isChecked(),false,'[EVID-007] suggestions never silently link')
 await audit(operator,'EVID-007-operator-suggestions')
 await suggested.check()
 const recorded=await save(operator,recorder,'Record evidence','/api/operator/evidence')
 const card=operator.locator(`#evidence-${recorded.id}`)
 await card.waitFor()
 await card.getByText('Wording history and private files',{exact:true}).click()
 const edit=form(card,'Edit evidence wording')
 await edit.getByLabel('Evidence wording',{exact:true}).fill('The team needs onboarding progress visibility before renewal.')
 await audit(operator,'EVID-010-wording-editor')
 await save(operator,edit,'Save new version',`/api/operator/evidence/${recorded.id}/wording`)
 const versions=card.getByRole('region',{name:'Evidence wording versions',exact:true})
 const earlier=versions.locator('article').filter({has:operator.getByRole('heading',{name:/^Earlier wording ·/,level:4})})
 await earlier.getByRole('heading',{name:/^Earlier wording ·/,level:4}).waitFor()
 assert.equal(await earlier.locator('p').innerText(),originalWording,'[EVID-010] the earlier version retains the original recorded wording')
 await audit(operator,'EVID-010-version-history')
 const upload=form(card,'Attach evidence file')
 const attachmentPath=`/api/operator/evidence/${recorded.id}/attachments`
 const refresh={requested:false,status:null,finished:false,failed:false,historyOpen:null}
 const isRefresh=request=>request.method()==='GET'&&new URL(request.url()).pathname===attachmentPath
 const requested=request=>{if(isRefresh(request))refresh.requested=true}
 const responded=response=>{if(isRefresh(response.request()))refresh.status=response.status()}
 const finished=request=>{if(isRefresh(request))refresh.finished=true}
 const failed=request=>{if(isRefresh(request))refresh.failed=true}
 operator.on('request',requested);operator.on('response',responded);operator.on('requestfinished',finished);operator.on('requestfailed',failed)
 try{
  await boundedStep(operator,'EVID-008: choose private attachment',()=>upload.getByLabel('Evidence file',{exact:true}).setInputFiles({name:'interview-note.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nOperator interview note\n%%EOF')},{timeout:30_000}))
  await save(operator,upload,'Attach private file',attachmentPath)
  await boundedStep(operator,'EVID-008: open private file history',async()=>{
   const history=card.locator('details').filter({has:operator.locator('summary').filter({hasText:/^Wording history and private files$/})})
   // The native disclosure has no persisted open state. Inspect its current
   // state after the save and use the normal summary control when necessary.
   if(await history.getAttribute('open',{timeout:30_000})===null)await history.locator('summary').click({timeout:30_000})
   refresh.historyOpen=await history.getAttribute('open',{timeout:30_000})!==null
   assert.equal(refresh.historyOpen,true,'[EVID-008] private file history is open through its disclosure control')
  },{details:()=>refresh})
  await boundedStep(operator,'EVID-008: rendered private attachment link',()=>card.getByRole('link',{name:'interview-note.pdf',exact:true}).waitFor({timeout:30_000}),{details:()=>refresh})
 }finally{
  operator.off('request',requested);operator.off('response',responded);operator.off('requestfinished',finished);operator.off('requestfailed',failed)
 }
 await audit(operator,'EVID-008-private-attachment')
 await operator.goto(origin+`/app/customers/${saved.slug}`,{waitUntil:'networkidle'})
 await operator.getByRole('heading',{name:'Linked requests',exact:true}).waitFor()
 await operator.getByRole('link',{name:requestTitle,exact:true}).waitFor()
 await operator.getByText('The team needs onboarding progress visibility before renewal.',{exact:false}).waitFor()
 await operator.getByText('Edit private account context',{exact:true}).click()
 await audit(operator,'EVID-005-account-commercial-evidence-requests')
 await requester.goto(origin+'/portal/feedback/new',{waitUntil:'networkidle'})
 await requester.getByLabel('Title',{exact:true}).fill('onboarding progress')
 await requester.getByLabel('Problem description',{exact:true}).fill('Draft that must be discarded')
 await requester.getByRole('heading',{name:'Similar feedback',exact:true}).waitFor()
 await requesterAudit(requester,'EVID-007-requester-suggestions')
 await requester.getByRole('button',{name:'Vote',exact:true}).click()
 await requester.getByRole('heading',{name:'Vote saved',exact:true}).waitFor()
 await requesterAudit(requester,'REQ-004-suggestion-vote-draft-discarded')
 await requester.getByRole('button',{name:'Start a new request',exact:true}).click()
 assert.equal(await requester.getByLabel('Title',{exact:true}).inputValue(),'')
 assert.equal(await requester.getByLabel('Problem description',{exact:true}).inputValue(),'')
 await requester.getByLabel('Title',{exact:true}).fill('onboarding progress')
 await requester.getByLabel('Problem description',{exact:true}).fill('Another draft that must be discarded')
 await requester.getByRole('button',{name:'Unfollow',exact:true}).click()
 await requester.getByRole('button',{name:'Follow',exact:true}).click()
 await requester.getByRole('heading',{name:'Following feedback',exact:true}).waitFor()
 await requesterAudit(requester,'REQ-004-suggestion-follow-draft-discarded')
 return {evidenceId:recorded.id,accountSlug:saved.slug,accountId:saved.id}
}
