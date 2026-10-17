import assert from 'node:assert/strict'

/** Keep explicit permission journeys separate from automatic board subscriptions. */
export async function explicitConsentBoard(origin,slug,cookie){
 const response=await fetch(origin+'/api/public/boards')
 assert.equal(response.status,200,await response.clone().text())
 const board=(await response.json()).find(board=>board.slug===slug)
 assert.ok(board?.subscriptionDisclosure,'public board has a subscription disclosure')
 const saved=await fetch(origin+`/api/operator/boards/${slug}/vote-subscriptions`,{
  method:'PUT',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},
  body:JSON.stringify({enabled:false,version:board.subscriptionDisclosure.version}),
 })
 assert.equal(saved.status,200,await saved.clone().text())
}
