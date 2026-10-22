import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { shot,manifest,openRequestControls } from './requester-evidence.mjs'
import { requesterAuth } from './requester-auth.mjs'
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']}),errors=[],checks=[]
let runtime
try {
 const harness=await requesterAuth(browser);runtime=harness.runtime
 const {origin,api,sql,explicitConsentBoard}=harness,unique=Date.now().toString(36),board=`repair-${unique}`
 const setup=await harness.operator(1440)
 await api('/api/operator/boards',{slug:board,name:'Product feedback',visibility:'public'},setup.page.request)
 await explicitConsentBoard(board,setup.page.request);await setup.context.close()
 for(const width of [1440,390]){
  const {context:requester,page,token}=await harness.requester(width,`repair-${unique}-${width}@example.test`),auth={Authorization:`Bearer ${token}`}
  const {context:operator,page:review}=await harness.operator(width)
  for(const p of [page,review])p.on('pageerror',error=>errors.push(error.message))
  const title=`Scheduled exports ${width} ${unique}`
  await page.goto(origin+'/portal/feedback/new');await page.getByLabel('Title',{exact:true}).fill(title)
  await page.getByLabel('Problem description',{exact:true}).fill('A monthly export removes repetitive accountant handoffs.')
  await page.locator('select[name=board]').selectOption(board)
  await page.getByRole('button',{name:'Send for review',exact:true}).click()
  await page.getByRole('heading',{name:'Feedback is awaiting review',exact:true}).waitFor();await shot(page,'submitted',width)
  const activity=await (await api('/api/public/requester/activity',undefined,auth)).json(),slug=activity.requests[0].slug
  await review.goto(origin+'/app/moderation')
  const card=review.locator('article').filter({has:review.getByRole('heading',{name:title,exact:true})})
  await card.getByLabel('Public title',{exact:true}).fill(title)
  await card.locator('textarea[name=description]').fill('Schedule monthly exports for your accountant.')
  await card.locator('select[name=boardSlug]').selectOption(board)
  await card.getByLabel('Approved display name',{exact:true}).first().fill('Reviewed requester')
  assert.equal(await card.getByRole('button',{name:'Approve request edit',exact:true}).count(),0)
  await card.getByRole('button',{name:'Approve and publish',exact:true}).click()
  await review.getByText('Approved wording is now public.',{exact:true}).waitFor();await shot(review,'approved',width)
  await page.goto(origin+`/portal/feedback/${slug}`)
  // Submission records the author's vote; remove and restore it through the mounted controls.
  await page.getByRole('button',{name:'Remove vote',exact:true}).click();await page.getByText('Vote removed.',{exact:true}).waitFor()
  await page.getByRole('button',{name:'Vote',exact:true}).click();await page.getByText('Vote saved.',{exact:true}).waitFor();await shot(page,'voted',width)
  await page.getByRole('button',{name:'Follow',exact:true}).click();await page.getByText('Following with email permission.',{exact:true}).waitFor();await shot(page,'followed',width)
  await page.getByLabel('Add a comment',{exact:true}).fill('Monthly scheduling avoids a manual step.')
  await page.getByRole('button',{name:'Send comment for review',exact:true}).click();await page.getByText('Your comment is awaiting review.',{exact:true}).waitFor();await shot(page,'comment-held',width)
  await review.reload();await openRequestControls(card)
  const comment=card.locator('form').filter({has:review.getByRole('heading',{name:'Comment',exact:true})})
  await shot(review,'comment-approval-ready',width)
  await comment.getByLabel('Approved display name',{exact:true}).fill('Reviewed requester');await comment.getByRole('button',{name:'Approve comment',exact:true}).click();await comment.waitFor({state:'detached'})
  await openRequestControls(card);await shot(review,'comment-approved',width)
  const status=card.locator('form').filter({has:review.getByRole('heading',{name:'Publish status update',exact:true})})
  await status.locator('select[name=status]').selectOption('under_review');await status.getByLabel('Public update',{exact:true}).fill('We are reviewing monthly scheduling.');const statusSaved=review.waitForResponse(r=>r.url().endsWith(`/api/operator/requests/${slug}/status-updates`)&&r.request().method()==='POST');await status.getByRole('button',{name:'Publish status update',exact:true}).click();assert.equal((await statusSaved).status(),200)
  await page.reload();await page.getByText('We are reviewing monthly scheduling.',{exact:true}).waitFor();await page.getByText('Monthly scheduling avoids a manual step.',{exact:true}).waitFor();await shot(page,'status-published',width)
  // A duplicate choice is a vote only, even when the draft itself is complete.
  await api(`/api/public/requests/${slug}/vote`,undefined,auth,'DELETE')
  const before=(await sql('SELECT (SELECT COUNT(*) FROM requests) requests,(SELECT COUNT(*) FROM evidence_items) evidence'))[0]
  await page.goto(origin+'/portal/feedback/new');await page.getByLabel('Title',{exact:true}).fill(title)
  await page.getByLabel('Problem description',{exact:true}).fill('This unsent draft must not become a new submission.')
  await page.locator('select[name=board]').selectOption(board)
  const suggestion=page.locator('aside').locator('div').filter({has:page.getByRole('link',{name:title,exact:true})}).first()
  await suggestion.getByRole('button',{name:'Vote',exact:true}).click()
  await page.getByRole('heading',{name:'Vote saved',exact:true}).waitFor()
  assert.equal(await page.getByRole('heading',{name:'Feedback is awaiting review',exact:true}).count(),0)
  assert.equal(await page.getByText('Your feedback and its original evidence were saved.',{exact:false}).count(),0)
  await page.getByText('No new feedback was submitted.',{exact:false}).waitFor();await shot(page,'duplicate-vote-success',width)
  assert.deepEqual((await sql('SELECT (SELECT COUNT(*) FROM requests) requests,(SELECT COUNT(*) FROM evidence_items) evidence'))[0],before)
  checks.push({width,duplicateChoice:'vote',newRequests:0,newEvidence:0,falseSubmissionCopy:false})
  // The mounted appeal control can reopen an actual rejected edit.
  await api(`/api/public/requests/${slug}`,{title,description:'An edit with further scheduling detail.'},auth,'PATCH')
  let context=await (await api(`/api/operator/requests/${slug}/context`,undefined,review.request)).json()
  const edit=context.edits.find(item=>item.moderation_state==='awaiting_review')
  await api(`/api/operator/requests/edits/${edit.id}/moderate`,{verdict:'rejected',reason:'Please clarify the frequency.'},review.request)
  await api(`/api/public/requests/${slug}/appeals`,{subjectType:'request_edit',subjectId:edit.id,body:'The monthly frequency is now clear.'},auth)
  await review.reload();await openRequestControls(card)
  await card.getByLabel('Appeal decision reason',{exact:true}).fill('New context merits another review.')
  await card.getByRole('button',{name:'Reopen for moderation',exact:true}).click()
  await card.getByText('reopen: New context merits another review.',{exact:true}).waitFor()
  await card.getByRole('button',{name:'Approve request edit',exact:true}).waitFor();await shot(review,'appeal-reopened',width)
  context=await (await api(`/api/operator/requests/${slug}/context`,undefined,review.request)).json()
  assert.equal(context.appeals.at(-1).state,'reviewed');assert.equal(context.edits.find(item=>item.id===edit.id).moderation_state,'awaiting_review')
  checks.push({width,appealReopenedByMountedControl:true})
  // Synthetic interrupted metadata state, with original bytes uploaded via HTTP.
  const fileBytes=new TextEncoder().encode('%PDF-1.7 synthetic local recovery evidence'),form=new FormData()
  form.append('file',new Blob([fileBytes],{type:'application/pdf'}),'recovery.pdf')
  const upload=await fetch(origin+`/api/public/requests/${slug}/attachments`,{method:'POST',headers:{Origin:origin,...auth},body:form})
  assert.equal(upload.status,201);const {id:uploadId}=await upload.json()
  const fileHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',fileBytes))].map(b=>b.toString(16).padStart(2,'0')).join('')
  await sql(`INSERT INTO request_attachment_uploads(id,request_id,storage_key,original_filename,content_type,byte_size,sha256,created_at,updated_at) SELECT id,request_id,storage_key,original_filename,content_type,byte_size,'${fileHash}',created_at,updated_at FROM attachments WHERE id='${uploadId}'; DELETE FROM attachments WHERE id='${uploadId}'`)
  await review.reload();await openRequestControls(card)
  await card.getByLabel('Original file (only if stored bytes are missing)',{exact:true}).setInputFiles({name:'recovery.pdf',mimeType:'application/pdf',buffer:Buffer.from(fileBytes)})
  await shot(review,'upload-recovery-ready',width)
  await card.getByRole('button',{name:'Verify and recover upload',exact:true}).click()
  await card.getByRole('button',{name:'Verify and recover upload',exact:true}).waitFor({state:'detached'})
  await card.getByRole('button',{name:'Approve attachment',exact:true}).waitFor();await shot(review,'upload-recovered',width)
  const recovered=await api(`/api/operator/attachments/${uploadId}`,undefined,review.request)
  assert.deepEqual(new Uint8Array(await recovered.arrayBuffer()),fileBytes)
  checks.push({width,syntheticInterruptedUploadRecoveredByMountedControl:true,originalBytesPreserved:true})
  // A withdrawn pending request vanishes from the real moderation screen.
  const pending=await (await api('/api/public/requests',{title:`Withdraw me ${width}`,description:'Pending withdrawal',boardSlug:board,idempotencyKey:crypto.randomUUID()},auth)).json()
  await api(`/api/public/requests/${pending.slug}/withdraw`,{},auth)
  await review.reload();assert.equal(await review.getByRole('heading',{name:`Withdraw me ${width}`,exact:true}).count(),0);await shot(review,'withdrawn-removed-from-moderation',width)
  checks.push({width,withdrawnPendingNotActionable:true,initialSubmissionHasNoEditApproval:true})
  await page.goto(origin+'/portal/feedback/activity');await page.getByRole('heading',{name:title,exact:true}).first().waitFor();await shot(page,'your-feedback',width)
  await page.goto(origin+'/portal/feedback');await page.getByLabel('Search feedback',{exact:true}).fill('Scheduled exports');await page.locator('select[name=status]').selectOption('under_review');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('heading',{name:title,exact:true}).waitFor();await shot(page,'search-filter',width)
  await requester.close();await operator.close()
 }
 await manifest('manifest',errors,checks,origin)
}finally{await browser.close();await runtime?.close()}
