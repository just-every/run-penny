import assert from 'node:assert/strict'
import {moderationJourney} from './moderation-runtime.mjs'

await moderationJourney('merge-notices',async({runtime,origin,operator,json,send,person,pageFor,capture})=>{
 const author=await person('morgan@example.test','Morgan Reed'),first=await person('eli@example.test','Eli Wong'),overlap=await person('dana@example.test','Dana Jones'),voter=await person('quinn@example.test','Quinn Carter')
 const auth=who=>({Authorization:`Bearer ${who.token}`})
 async function request(title){
  const item=await json('/api/public/requests',{title,description:'Finance needs consistent exports for its monthly review.',boardSlug:'finance',idempotencyKey:crypto.randomUUID()},auth(author),'POST',201)
  await json(`/api/operator/moderation/${item.slug}`,{verdict:'approved',title,description:'Prepare consistent monthly finance exports.',boardSlug:'finance',displayName:'Morgan Reed'},operator)
  return item
 }
 const source=await request('Automate finance CSV reports'),target=await request('Scheduled monthly finance exports')
 for(const who of [first,overlap])await send(`/api/public/requests/${source.slug}/follow`,{},auth(who),'POST',204)
 await send(`/api/public/requests/${target.slug}/follow`,{},auth(overlap),'POST',204)
 const boards=await json('/api/public/boards'),version=boards.find(board=>board.slug==='finance').subscriptionDisclosure.version
 await json('/api/operator/boards/finance/vote-subscriptions',{enabled:true,version},operator,'PUT')
 const current=(await json('/api/public/boards')).find(board=>board.slug==='finance').subscriptionDisclosure.version
 await send(`/api/public/requests/${source.slug}/vote`,{subscriptionVersion:current},auth(voter),'POST',204)
 const owner=await pageFor({cookie:operator.Cookie}),visitor=await pageFor()
 const sourceId=await runtime.db.prepare('SELECT id FROM requests WHERE slug=?').bind(source.slug).first('id')
 await owner.goto(origin+`/app/moderation?item=${sourceId}`,{waitUntil:'networkidle'})
 const card=owner.locator('article').filter({has:owner.getByRole('heading',{name:'Automate finance CSV reports',exact:true})}).first()
 async function openControls(){const summary=card.getByText('Discussion, status and request controls',{exact:true});await summary.waitFor();if(!await summary.evaluate(element=>element.closest('details').open))await summary.click()}
 await openControls()
 const form=card.getByRole('form',{name:'Merge duplicate request',exact:true})
 await form.getByLabel('Canonical request slug',{exact:true}).fill(target.slug)
 await form.getByRole('button',{name:'Review merge',exact:true}).click()
 await form.getByText(/2 eligible subscribers/).waitFor()
 assert.equal(await form.getByRole('checkbox',{name:'Notify subscribers about this merge'}).isChecked(),true)
 await form.scrollIntoViewIfNeeded();await capture(owner,'merge-recipient-preview',form)
 await form.getByRole('button',{name:'Merge duplicate',exact:true}).click();await owner.waitForLoadState('networkidle');await openControls()
 await card.getByRole('button',{name:'Unmerge',exact:true}).waitFor()
 await card.getByRole('button',{name:'Unmerge',exact:true}).scrollIntoViewIfNeeded();await capture(owner,'merge-saved',card)
 const count=await runtime.db.prepare("SELECT COUNT(*) FROM notification_intents i JOIN notification_events e ON e.id=i.event_id WHERE e.kind='merge'").first('COUNT(*)')
 assert.equal(count,2)
 await visitor.goto(origin+`/portal/feedback/${source.slug}`,{waitUntil:'networkidle'})
 assert.equal(new URL(visitor.url()).pathname,`/portal/feedback/${target.slug}`)
 await visitor.getByRole('heading',{name:'Scheduled monthly finance exports',exact:true}).waitFor()
 for(const email of ['eli@example.test','dana@example.test','quinn@example.test'])assert.equal((await visitor.content()).includes(email),false)
 await capture(visitor,'canonical-after-merge')
 await card.getByRole('button',{name:'Unmerge',exact:true}).click();await owner.waitForLoadState('networkidle');await openControls()
 await form.getByLabel('Canonical request slug',{exact:true}).waitFor();await form.getByLabel('Canonical request slug',{exact:true}).fill(target.slug)
 await form.getByRole('button',{name:'Review merge',exact:true}).click()
 await form.getByText(/2 eligible subscribers/).waitFor()
 await form.getByRole('checkbox',{name:'Notify subscribers about this merge'}).uncheck()
 await form.scrollIntoViewIfNeeded();await capture(owner,'merge-notice-opt-out',form)
 await form.getByRole('button',{name:'Merge duplicate',exact:true}).click();await owner.waitForLoadState('networkidle');await openControls()
 await card.getByRole('button',{name:'Unmerge',exact:true}).waitFor()
 const after=await runtime.db.prepare("SELECT COUNT(*) FROM notification_intents i JOIN notification_events e ON e.id=i.event_id WHERE e.kind='merge'").first('COUNT(*)')
 assert.equal(after,2)
 await card.getByRole('button',{name:'Unmerge',exact:true}).scrollIntoViewIfNeeded();await capture(owner,'silent-merge-saved',card)
})
