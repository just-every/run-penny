import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {moderationJourney} from './moderation-runtime.mjs'
import {zendeskSidebar} from './zendesk-sdk-edge.mjs'

export async function zendeskProxyVotesJourney({runtime,origin,operator,json,send,person,pageFor,capture}){
 const author=await person('eli@example.test','Eli Wong')
 await person('nina@example.test','Nina Rao')
 const request=await json('/api/public/requests',{title:'Schedule monthly finance exports',description:'Finance needs a monthly CSV for its board review.',boardSlug:'finance',idempotencyKey:crypto.randomUUID()},{Authorization:`Bearer ${author.token}`},'POST',201)
 await json(`/api/operator/moderation/${request.slug}`,{verdict:'approved',title:'Schedule monthly finance exports',description:'Schedule monthly exports for finance reviews.',boardSlug:'finance',displayName:'Eli Wong'},operator)
 await json('/api/operator/boards/finance/vote-importance',{enabled:true,labels:['Nice to have','Important','Must have']},operator,'PUT')
 const {token:key,credential}=await json('/api/operator/integrations/keys',{name:'Zendesk sidebar',scopes:['requests:read','votes:write']},operator,'POST',201)
 // A separate page represents the Zendesk-hosted iframe, using real app bytes.
 // pageFor's public-Penny network guard remains on its own page.
 const owner=await pageFor({cookie:operator.Cookie}),page=await owner.context().newPage()
 page.setDefaultTimeout(20000)
 const sdk=await zendeskSidebar({page,origin,key,ticket:{'ticket.id':738,'ticket.requester.name':'Nina Rao','ticket.requester.email':'nina@example.test','currentAccount.subdomain':'harbor'}})
 const posts=()=>sdk.calls.filter(call=>call.type==='POST')
 const customerId=await runtime.db.prepare('SELECT requester_id FROM requester_addresses WHERE email=?').bind('nina@example.test').first('requester_id')
 async function chooseRequest(){
  await page.getByLabel('Find a request',{exact:true}).fill('monthly finance')
  await page.getByRole('button',{name:'Search requests',exact:true}).click()
  await page.getByLabel('Request',{exact:true}).selectOption(request.slug)
 }
 async function reviewSource(){
  await page.getByLabel('Source justifying this vote').fill('Nina asked for scheduled monthly exports in ticket 738.')
  await page.getByLabel('I reviewed the customer, request and source.').check()
 }
 await sdk.open()
 await page.getByLabel('Find an existing customer').waitFor()
 await page.getByRole('button',{name:'Find customer',exact:true}).click()
 await page.getByRole('option',{name:/Nina Rao/}).waitFor({state:'attached'})
 assert.equal(await page.getByLabel('Existing customer',{exact:true}).inputValue(),'')
 await chooseRequest()
 await reviewSource()
 // Search results must never silently choose a customer.
 await page.getByRole('button',{name:'Record proxy vote',exact:true}).click()
 await page.getByRole('alert').filter({hasText:'Select an existing customer'}).waitFor()
 assert.equal(posts().length,0)
 await page.getByLabel('Existing customer',{exact:true}).selectOption(customerId)
 await page.getByLabel('I reviewed the customer, request and source.').check()
 await page.getByLabel('Customer’s stated importance (optional)').selectOption('3')
 await page.getByLabel('I reviewed the customer, request and source.').check()
 await capture(page,'zendesk-existing-review')
 await page.getByRole('button',{name:'Record proxy vote',exact:true}).click()
 await page.getByRole('status').filter({hasText:'Customer vote recorded.'}).waitFor()
 assert.equal(posts().length,1)
 assert.equal(await runtime.db.prepare('SELECT importance FROM penny_vote_importance WHERE requester_id=?').bind(customerId).first('importance'),3)
 assert.deepEqual(JSON.parse(posts()[0].data),{requesterId:customerId,source:'Nina asked for scheduled monthly exports in ticket 738.',sourceUrl:'https://harbor.zendesk.com/agent/tickets/738',importance:3})
 await page.getByLabel('I reviewed the customer, request and source.').check()
 await page.getByRole('button',{name:'Record proxy vote',exact:true}).click()
 await page.getByRole('status').filter({hasText:'already supports'}).waitFor()
 assert.equal(await runtime.db.prepare('SELECT COUNT(*) n FROM penny_proxy_votes WHERE requester_id=?').bind(customerId).first('n'),1)
 await capture(page,'zendesk-existing-result')

 // A changed ticket clears the selected customer and source before another vote.
 await sdk.changeTicket({'ticket.id':739,'ticket.requester.name':'Sam Rivera','ticket.requester.email':'sam@example.test','currentAccount.subdomain':'harbor'})
 await page.getByText('Sam Rivera · sam@example.test',{exact:true}).waitFor()
 assert.equal(await page.getByLabel('Existing customer',{exact:true}).inputValue(),'')
 assert.equal(await page.getByLabel('Source justifying this vote').inputValue(),'')
 await page.getByRole('button',{name:'Find customer',exact:true}).click()
 await page.getByRole('status').filter({hasText:'No customers found'}).waitFor()
 await page.getByLabel('Create a new unverified contact').check()
 await page.getByLabel('I confirm this new contact represents the ticket requester.').check()
 await page.getByLabel('Source justifying this vote').fill('Sam requested a monthly export in ticket 739.')
 await page.getByLabel('I reviewed the customer, request and source.').check()
 await capture(page,'zendesk-new-contact-review')
 await page.getByRole('button',{name:'Record proxy vote',exact:true}).click()
 await page.getByRole('status').filter({hasText:'Customer vote recorded.'}).waitFor()
 const contact=await runtime.db.prepare('SELECT requester_id,verified_at FROM requester_addresses WHERE email=?').bind('sam@example.test').first()
 assert.equal(contact.verified_at,null)
 assert.equal(await runtime.db.prepare('SELECT COUNT(*) n FROM requester_update_permissions WHERE requester_id IN (?,?)').bind(contact.requester_id,customerId).first('n'),0)
 assert.deepEqual(JSON.parse(posts().at(-1).data),{contact:{displayName:'Sam Rivera',email:'sam@example.test'},source:'Sam requested a monthly export in ticket 739.',sourceUrl:'https://harbor.zendesk.com/agent/tickets/739'})
 const attribution=await runtime.db.prepare('SELECT p.source_url,p.recorder_operator_id FROM penny_proxy_votes p WHERE p.requester_id=?').bind(contact.requester_id).first()
 assert.equal(attribution.source_url,'https://harbor.zendesk.com/agent/tickets/739')
 assert.ok(attribution.recorder_operator_id)
 const csv=await (await send('/api/operator/votes/export.csv',undefined,operator)).text()
 assert.ok(csv.includes('Sam Rivera')&&csv.includes('739')&&csv.includes('Maya Patel'))
 const publicRequest=await json('/api/public/requests/'+request.slug)
 const publicBytes=JSON.stringify(publicRequest)
 for(const privateValue of ['Sam Rivera','Nina Rao','sam@example.test','nina@example.test','harbor.zendesk.com'])assert.equal(publicBytes.includes(privateValue),false)
 const votes=await runtime.db.prepare('SELECT COUNT(*) n FROM request_votes WHERE request_id=(SELECT id FROM requests WHERE slug=?)').bind(request.slug).first('n')
 assert.equal(votes,3)
 assert.equal(await page.evaluate(secret=>JSON.stringify({storage:{...localStorage},html:document.documentElement.outerHTML}).includes(secret),key),false)
 await capture(page,'zendesk-new-contact-result')

 // Revocation is enforced by Penny on the next real proxy request and is visible.
 await send('/api/operator/integrations/keys/'+credential.id,undefined,operator,'DELETE')
 await page.getByLabel('I reviewed the customer, request and source.').check()
 await page.getByRole('button',{name:'Record proxy vote',exact:true}).click()
 await page.getByRole('alert').filter({hasText:'Penny refused access'}).waitFor()
 assert.equal(await runtime.db.prepare('SELECT COUNT(*) n FROM request_votes WHERE request_id=(SELECT id FROM requests WHERE slug=?)').bind(request.slug).first('n'),3)
 await capture(page,'zendesk-revoked-key')
 const callCount=sdk.calls.length
 sdk.configure({penny_origin:'http://penny.example.test',penny_host:'penny.example.test'})
 await sdk.open()
 await page.getByRole('alert').filter({hasText:'valid Penny HTTPS origin'}).waitFor()
 assert.equal(sdk.calls.length,callCount)
 await capture(page,'zendesk-invalid-origin')
 assert.deepEqual(sdk.errors,[])
 assert.equal(runtime.outbox.filter(message=>message.email==='sam@example.test').length,0)
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await moderationJourney('zendesk-proxy-votes',zendeskProxyVotesJourney)
