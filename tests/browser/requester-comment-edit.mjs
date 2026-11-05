import assert from 'node:assert/strict'
import {expect} from '@playwright/test'
import {openRequestControls,shot} from './requester-evidence.mjs'

/** Exercise the existing requester and operator controls once at desktop width. */
export async function proveRequesterCommentEdit({browser,harness,page,review,card,slug,auth}){
 const {origin,api}=harness
 const detail=async()=>(await api(`/api/public/requests/${slug}`)).json()
 const activity=async()=>(await api('/api/public/requester/activity',undefined,auth)).json()
 const context=async()=>(await api(`/api/operator/requests/${slug}/context`,undefined,review.request)).json()
 const original=await detail(),comment=original.comments[0]
 assert.ok(comment,'the public request has an approved comment before editing')
 const listPath=`/api/public/requests?board=${original.board.slug}`
 const originalList=await(await api(listPath)).json()
 assert.ok(originalList.some(item=>item.slug===slug&&item.commentCount===1))
 const rejected='Synthetic Penny scheduling clarification for review.'
 const replacement='Synthetic Penny approved scheduling clarification.'
 const reason='Keep the approved question until the frequency is clear.'
 const visitor=await browser.newContext({viewport:{width:1440,height:1000}})
 const publicPage=await visitor.newPage()
 async function screens(target,name){
  await shot(target,name,1440)
  await target.setViewportSize({width:390,height:844})
  try{await shot(target,name,390)}finally{await target.setViewportSize({width:1440,height:1000})}
 }
 const submitted=body=>page.locator('section').filter({has:page.getByRole('heading',{name:'Comment edit',exact:true})}).filter({has:page.getByText(body,{exact:true})}).last()
 async function readPublic(body,label){
  const current=await detail()
  assert.deepEqual(current.comments,[{...comment,body}])
  assert.deepEqual({...current,comments:original.comments},original)
  assert.deepEqual(await(await api(listPath)).json(),originalList)
  await publicPage.goto(origin+`/portal/feedback/${slug}`)
  const discussion=publicPage.getByRole('region',{name:'Published comments',exact:true})
  await expect(discussion.getByText(body,{exact:true})).toBeVisible()
  await expect(discussion.getByText(rejected,{exact:true})).toHaveCount(0)
  if(body!==replacement)await expect(discussion.getByText(replacement,{exact:true})).toHaveCount(0)
  else await expect(discussion.getByText(comment.body,{exact:true})).toHaveCount(0)
  await screens(publicPage,label)
 }
 async function edit(body){
  await page.goto(origin+'/portal/feedback/activity')
  await page.getByRole('textbox',{name:/^Edit comment\b/}).fill(body)
  const saved=page.waitForResponse(response=>new URL(response.url()).pathname===`/api/public/comments/${comment.id}`&&response.request().method()==='PATCH')
  await page.getByRole('button',{name:'Send comment edit for review',exact:true}).click()
  const response=await saved
  assert.equal(response.status(),200,await response.text())
  await expect(submitted(body).getByText('awaiting review',{exact:true})).toBeVisible()
  const pending=(await context()).commentEdits.find(item=>item.comment_id===comment.id&&item.body===body)
  assert.ok(pending)
  assert.equal(pending.moderation_state,'awaiting_review')
  assert.deepEqual((await activity()).commentEdits.find(item=>item.id===pending.id),{
   id:pending.id,slug,available:1,body,moderationState:'awaiting_review',rejectionReason:null,
  })
  return pending.id
 }
 async function verdict(editId,body,verdict){
  await review.reload();await openRequestControls(card)
  const form=card.locator('form').filter({has:review.getByRole('heading',{name:'Comment edit',exact:true})}).filter({has:review.getByText(body,{exact:true})})
  await expect(form.getByText(body,{exact:true})).toBeVisible()
  if(verdict==='rejected')await form.getByLabel('Rejection reason',{exact:true}).fill(reason)
  await screens(review,`comment-edit-${verdict}-review`)
  const saved=review.waitForResponse(response=>new URL(response.url()).pathname===`/api/operator/comments/edits/${editId}/moderate`&&response.request().method()==='POST')
  await form.getByRole('button',{name:verdict==='approved'?'Approve comment edit':'Reject',exact:true}).click()
  const response=await saved
  assert.equal(response.status(),200,await response.text())
  await expect(form).toHaveCount(0)
  assert.equal((await context()).commentEdits.find(item=>item.id===editId).moderation_state,verdict)
 }
 try{
  const first=await edit(rejected)
  await screens(page,'comment-edit-pending-activity')
  await readPublic(comment.body,'comment-edit-pending-public')
  await verdict(first,rejected,'rejected')
  await page.reload()
  await expect(submitted(rejected).getByText('rejected',{exact:true})).toBeVisible()
  await expect(submitted(rejected).getByText(`Reason: ${reason}`,{exact:true})).toBeVisible()
  await screens(page,'comment-edit-rejected-activity')
  await readPublic(comment.body,'comment-edit-rejected-public')
  const second=await edit(replacement)
  assert.notEqual(second,first)
  await readPublic(comment.body,'comment-edit-second-pending-public')
  await verdict(second,replacement,'approved')
  await page.reload()
  await expect(submitted(replacement).getByText('approved',{exact:true})).toBeVisible()
  assert.equal((await activity()).comments.find(item=>item.id===comment.id).body,replacement)
  await readPublic(replacement,'comment-edit-approved-public')
  await publicPage.reload()
  await expect(publicPage.getByRole('region',{name:'Published comments',exact:true}).getByText(replacement,{exact:true})).toBeVisible()
  console.log('PROBE REQ-020 holding comment edit: mounted own-comment form -> pending private edit; signed-out list, detail and page retain approved wording and identity')
  console.log('PROBE REQ-020 comment verdicts: mounted rejection -> original persists; second edit and approval -> only replacement public under original identity, including reload')
  return {commentEditControls:true,pendingTextPrivate:true,rejectedTextPrivate:true,approvedReplacementSameIdentity:true,commentCountUnchanged:true}
 }finally{await visitor.close()}
}
