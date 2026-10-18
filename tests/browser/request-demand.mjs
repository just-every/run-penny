import assert from 'node:assert/strict'
import {moderationJourney} from './moderation-runtime.mjs'

await moderationJourney('request-demand',async({runtime,origin,operator,json,send,person,pageFor,capture})=>{
 const first=await person('eli@example.test','Eli Wong'),second=await person('morgan@example.test','Morgan Reed')
 const auth={Authorization:`Bearer ${first.token}`},other={Authorization:`Bearer ${second.token}`}
 const request=await json('/api/public/requests',{title:'Schedule monthly finance exports',description:'Finance needs a monthly CSV for its board review.',boardSlug:'finance',idempotencyKey:crypto.randomUUID()},auth,'POST',201)
 await json(`/api/operator/moderation/${request.slug}`,{verdict:'approved',title:'Schedule monthly finance exports',description:'Schedule monthly CSV exports for finance reviews.',boardSlug:'finance',displayName:'Eli Wong'},operator)
 await send(`/api/public/requests/${request.slug}/vote`,{},other,'POST',204)
 const db=runtime.db,actor=await db.prepare('SELECT id FROM operators').first('id'),requestId=await db.prepare('SELECT id FROM requests WHERE slug=?').bind(request.slug).first('id'),now=new Date().toISOString()
 const accounts=[]
 for(const name of ['Harbor Analytics','Northstar Logistics','Cedar Health'])accounts.push(await json('/api/operator/accounts',{name,internalOwnerId:actor},operator,'POST',201))
 const people=(await db.prepare('SELECT id,display_name FROM requesters').all()).results,eli=people.find(person=>person.display_name==='Eli Wong'),morgan=people.find(person=>person.display_name==='Morgan Reed')
 for(const [person,account] of [[eli,accounts[0]],[morgan,accounts[0]],[morgan,accounts[1]]])await db.prepare('INSERT INTO requester_account_links(requester_id,account_id,created_at) VALUES(?,?,?)').bind(person.id,account.id,now).run()
 await db.prepare('INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),morgan.id,'morgan.finance@example.test',now,now,now).run()
 await json('/api/operator/evidence',{sourceType:'sales_call',wording:'A monthly export prevents manual finance reconciliation.',observedAt:now,accountId:accounts[2].id,requestLinks:[{id:requestId,stance:'supporting'}]},operator,'POST',201)
 // A retained supporter history longer than the old 100-person display cap.
 const given=['Alex','Jamie','Taylor','Jordan','Casey','Avery','Robin','Drew','Blair','Quinn','Cameron'],family=['Adams','Bennett','Chen','Diaz','Evans','Foster','Green','Harris','Ito','Jones']
 const statements=[]
 for(let index=0;index<101;index++){
  const id=String(index+1).padStart(26,'0'),displayName=`${given[index%given.length]} ${family[Math.floor(index/given.length)]}`
  statements.push(db.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,?,?,?)').bind(id,displayName,now,now),db.prepare('INSERT INTO request_vote_contributions(request_id,requester_id,created_at,updated_at) VALUES(?,?,?,?)').bind(requestId,id,now,now),db.prepare('INSERT INTO request_votes(request_id,requester_id,created_at,updated_at) VALUES(?,?,?,?)').bind(requestId,id,now,now))
 }
 await db.batch(statements)
 await db.prepare("INSERT INTO request_vote_supporter_types(request_id,requester_id,supporter_type,created_at) VALUES(?,?,'proxy',?)").bind(requestId,'00000000000000000000000101',now).run()
 const owner=await pageFor({cookie:operator.Cookie}),visitor=await pageFor()
 await owner.goto(origin+'/app/moderation?q=Schedule%20monthly',{waitUntil:'networkidle'})
 const card=owner.locator('article').filter({has:owner.getByRole('heading',{name:'Schedule monthly finance exports',exact:true})}).first()
 await card.getByRole('region',{name:'Customer demand'}).waitFor()
 const demand=card.getByRole('region',{name:'Customer demand'})
 assert.deepEqual(await demand.locator('dl[aria-label="Demand figures"] dd').allTextContents(),['103','2','3'])
 await card.getByText('Votes by account',{exact:true}).first().click()
 assert.match(await card.getByRole('list',{name:'Votes by account',exact:true}).textContent(),/No linked account101 votes/)
 await card.getByText('Supporters (103)',{exact:true}).click()
 await demand.evaluate(element=>scrollBy(0,element.getBoundingClientRect().top-100))
 await capture(owner,'demand-overview',demand)
 while(await card.getByRole('button',{name:/Show more supporters/}).count())await card.getByRole('button',{name:/Show more supporters/}).click()
 assert.equal(await card.getByRole('list',{name:'Supporters',exact:true}).locator(':scope > li').count(),103)
 await card.getByText('morgan.finance@example.test',{exact:true}).waitFor()
 await card.getByText('Proxy, entered by a UserVoice admin',{exact:true}).waitFor()
 const morganRow=card.getByRole('list',{name:'Supporters',exact:true}).locator(':scope > li').filter({hasText:'Morgan Reed'})
 await morganRow.scrollIntoViewIfNeeded()
 await capture(owner,'supporter-attribution',morganRow)
 await card.getByText('Supporters (103)',{exact:true}).click()
 await json(`/api/operator/requesters/${morgan.id}/block`,{},operator)
 await owner.reload({waitUntil:'networkidle'})
 assert.deepEqual(await owner.getByRole('region',{name:'Customer demand'}).locator('dl[aria-label="Demand figures"] dd').allTextContents(),['102','2','2'])
 await owner.getByRole('region',{name:'Customer demand'}).evaluate(element=>scrollBy(0,element.getBoundingClientRect().top-100))
 await capture(owner,'demand-after-block',owner.getByRole('region',{name:'Customer demand'}))
 await visitor.goto(origin+`/portal/feedback/${request.slug}`,{waitUntil:'networkidle'})
 for(const value of ['morgan@example.test','morgan.finance@example.test','Harbor Analytics','Northstar Logistics','Cedar Health'])assert.equal((await visitor.content()).includes(value),false)
 await capture(visitor,'public-demand-privacy')
})
