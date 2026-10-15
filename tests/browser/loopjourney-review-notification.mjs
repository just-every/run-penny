import assert from 'node:assert/strict'

// Observe the real minute Cron through its in-app notification; dev mail is silent.
export async function waitForReviewNotification(operator,runtime,commit,audit){
 const deadline=Date.now()+90000
 while(Date.now()<deadline){
  const response=await operator.context().request.get(runtime.origin+'/api/operator/notifications')
  assert.equal(response.status(),200)
  const {reviews}=await response.json()
  if(reviews.some(review=>review.decisionId===commit.decisionId)){
   await operator.reload({waitUntil:'networkidle'})
   await audit(operator,'NOTIFY-003-owner-review-notification')
   return
  }
  await operator.waitForTimeout(2000)
 }
 throw new Error('The real minute Cron did not produce the owner review notification.')
}
