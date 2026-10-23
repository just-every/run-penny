import assert from 'node:assert/strict'

export async function reviewRoadmapRecord({page,db,goto,capture}) {
 const id='attention-planned',card=page.locator(`#roadmap-item-${id}`)
 const approval=await db.prepare('SELECT * FROM roadmap_publications WHERE roadmap_item_id=?').bind(id).first()
 const form=card.getByRole('form',{name:'Edit internal record',exact:true})
 await openRecordBeforeHydration(page,card,form)
 const fields={
  'Internal title':'Make reporting dependable',
  'Internal summary':'Keep the evidence beside each reporting decision.',
  'Target window':'2026-Q4',
  'Account impact':'Finance teams can finish their monthly review.',
  'Delivery notes':'Release after the reporting review.',
  'Draft customer-safe title':'Clearer monthly reporting',
  'Draft customer-safe summary':'Follow every reporting step with confidence.',
 }
 for(const [label,value] of Object.entries(fields))await form.getByLabel(label,{exact:true}).fill(value)
 for(const [label,value] of [['Owner','attention-operator'],['Linked decision','attention-decision'],['Linked bet','page-bet-a'],['Confidence','medium']])await form.getByLabel(label,{exact:true}).selectOption(value)
 await form.getByLabel('Browser-local observed time',{exact:true}).check()
 const saved=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/operator/roadmap/${id}`&&r.request().method()==='PATCH')
 await form.getByRole('button',{name:'Save',exact:true}).click()
 assert.equal((await saved).status(),200,'[ROAD-002] internal record edits use the native route')
 await goto('/app/roadmap')
 await card.getByText('Edit, approve or move',{exact:true}).click()
 for(const [label,value] of Object.entries(fields))assert.equal(await form.getByLabel(label,{exact:true}).inputValue(),value,`[ROAD-002] ${label} persists`)
 for(const [label,value] of [['Owner','attention-operator'],['Linked decision','attention-decision'],['Linked bet','page-bet-a'],['Confidence','medium']])assert.equal(await form.getByLabel(label,{exact:true}).inputValue(),value,`[ROAD-002] ${label} persists`)
 assert.equal(await form.getByLabel('Browser-local observed time',{exact:true}).isChecked(),true,'[ROAD-002] explicitly linked evidence persists')
 assert.equal(await db.prepare('SELECT status FROM roadmap_items WHERE id=?').bind(id).first('status'),'planned','[ROAD-002] editing context preserves the item status')
 assert.deepEqual(await db.prepare('SELECT * FROM roadmap_publications WHERE roadmap_item_id=?').bind(id).first(),approval,'[ROAD-002] draft wording keeps the separately approved public projection')
 await capture('roadmap-complete-internal-record')
}

/** Hold delivery, not content, to exercise the server-rendered editing window. */
async function openRecordBeforeHydration(page,card,form) {
 let release
 const delivered=new Promise(resolve=>{release=resolve})
 const scripts=/\.js(?:\?|$)/
 const hold=async route=>{await delivered;await route.continue()}
 await page.route(scripts,hold)
 try {
  const response=await page.goto(new URL('/app/roadmap',page.url()).href,{waitUntil:'commit'})
  assert.equal(response.status(),200,'[ROAD-002] native roadmap document loads before hydration')
  await card.getByText('Edit, approve or move',{exact:true}).click()
  for(const label of ['Internal title','Internal summary','Owner']) {
   const field=form.getByLabel(label,{exact:true})
   await field.waitFor()
   assert.equal(await field.isDisabled(),true,`[ROAD-002] ${label} waits for its editing handler`)
  }
 } finally {release();await page.unroute(scripts,hold)}
}
