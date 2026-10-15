import assert from 'node:assert/strict'
import {api} from './operator-completeness-auth.mjs'
import {proofId} from './operator-completeness-data.mjs'
async function waitForReviewForm(card) {
 // The SSR form precedes hydration; real board options arrive from the mounted resource.
 // Wait before filling so a native pre-hydration submit cannot navigate without the mutation.
 await card.locator('select[name=boardSlug] option[value]:not([value=""])').first().waitFor({state:'attached'})
}
async function rejectRequest(page,origin,index,notify) {
 await page.goto(origin+`/app/moderation?item=${proofId(1,index)}`)
 const card=page.locator(`#request-proof-request-${String(index).padStart(2,'0')}`)
 await waitForReviewForm(card)
 await card.getByLabel('Reason (required for rejection)',{exact:true}).fill(`Proof rejection reason ${index}`)
 await card.getByLabel('Email the author this rejection reason',{exact:true}).setChecked(notify)
 const verdict=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith(`/proof-request-${String(index).padStart(2,'0')}/moderate`)||new URL(r.url()).pathname===`/api/operator/moderation/proof-request-${String(index).padStart(2,'0')}`)
 await card.getByRole('button',{name:'Reject feedback',exact:true}).click()
 assert.equal((await verdict).status(),200)
}
export async function reviewRejectionNotices({page,runtime,capture}) {
 const {origin,db}=runtime
 await rejectRequest(page,origin,0,true)
 await page.goto(origin+`/app/moderation?item=${proofId(1,1)}`)
 const card=page.locator('#request-proof-request-01')
 await waitForReviewForm(card)
 await card.locator('summary').filter({hasText:'Discussion, status and request controls'}).click()
 const comment=card.locator('form').filter({has:page.getByText('Proof held comment',{exact:false})})
 await comment.getByLabel('Rejection reason',{exact:true}).fill('Proof comment rejection reason')
 await comment.getByLabel('Email the author this rejection reason',{exact:true}).check()
 const verdict=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/operator/comments/${proofId(14)}/moderate`&&r.request().method()==='POST')
 await comment.getByRole('button',{name:'Reject',exact:true}).click()
 assert.equal((await verdict).status(),200)
 await rejectRequest(page,origin,2,false)
 await rejectRequest(page,origin,3,true)
 // Revoke the real fixture consent after enqueue, before native Cron delivery.
 await db.prepare('UPDATE requester_update_permissions SET revoked_at=? WHERE requester_id=?').bind(new Date().toISOString(),proofId(7,3)).run()
 assert.equal(typeof runtime.schedule,'function','Browser runtime must expose real compiled Worker Cron dispatch')
 await runtime.schedule();await runtime.schedule()
 const response=await api(page,'/api/operator/notifications')
 assert.equal(response.status(),200)
 const deliveries=(await response.json()).deliveries.filter(row=>row.kind==='rejection')
 for(const subject of [proofId(1),proofId(14)])assert.equal(deliveries.find(row=>row.subjectId===subject)?.state,'accepted','[REQ-030] eligible chosen author notice reaches real local transport')
 assert.equal(deliveries.some(row=>row.subjectId===proofId(1,2)),false,'[REQ-030] no notification choice sends no notice')
 const suppression=deliveries.find(row=>row.subjectId===proofId(1,3))
 assert.equal(suppression?.state,'suppressed');assert.ok(suppression.failureReason,'[REQ-030] rechecked revoked consent truthfully suppressed')
 await page.goto(origin+'/app/settings')
 await page.getByText('Provider accepted',{exact:false}).first().waitFor()
 await capture('REQ-030-visible-delivery-outcomes',page)
 await rejectRequest(page,origin,4,true)
 await runtime.configure({MAIL_PROVIDER:'',MAIL_FROM:''})
 await runtime.schedule()
 const failed=(await (await api(page,'/api/operator/notifications')).json()).deliveries.find(row=>row.kind==='rejection'&&row.subjectId===proofId(1,4))
 assert.equal(failed?.state,'failed');assert.equal(failed.failureReason,'mail_configuration_missing','[REQ-030] unconfigured mail reports actual failure')
 await page.goto(origin+'/app/settings');await page.getByText('mail configuration missing',{exact:false}).waitFor()
 await capture('REQ-030-unconfigured-mail-failure',page)
}
