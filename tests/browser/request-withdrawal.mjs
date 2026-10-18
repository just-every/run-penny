import assert from 'node:assert/strict'
import {moderationJourney} from './moderation-runtime.mjs'

await moderationJourney('request-withdrawal',async({origin,operator,json,send,person,pageFor,capture})=>{
 const identity=await person('eli@example.test','Eli Wong'),auth={Authorization:`Bearer ${identity.token}`}
 const make=async(title)=>json('/api/public/requests',{title,description:'Our finance team needs this workflow.',boardSlug:'finance',idempotencyKey:crypto.randomUUID()},auth,'POST',201)
 const request=await make('Schedule monthly finance exports')
 await json(`/api/operator/moderation/${request.slug}`,{verdict:'approved',title:'Schedule monthly finance exports',description:'Schedule monthly finance exports.',boardSlug:'finance',displayName:'Eli Wong'},operator)
 const pending=await make('Email the weekly finance summary')
 const customer=await pageFor({token:identity.token}),visitor=await pageFor(),owner=await pageFor({cookie:operator.Cookie})
 await customer.goto(origin+'/portal/feedback/activity',{waitUntil:'networkidle'})
 const card=title=>customer.locator('section').filter({has:customer.getByRole('heading',{name:title,exact:true})}).last()
 await card('Schedule monthly finance exports').getByRole('button',{name:'Withdraw request',exact:true}).waitFor()
 await capture(customer,'activity-before')
 for(const title of ['Schedule monthly finance exports','Email the weekly finance summary']){
  await card(title).getByRole('button',{name:'Withdraw request',exact:true}).click()
  await card(title).getByText('Withdrawn · withdrawn',{exact:true}).waitFor()
 }
 await capture(customer,'activity-withdrawn')
 assert.equal((await visitor.goto(origin+`/portal/feedback/${request.slug}`,{waitUntil:'networkidle'})).status(),410)
 await visitor.getByText('This feedback has been withdrawn.',{exact:true}).waitFor()
 await capture(visitor,'public-gone')
 await visitor.goto(origin+'/?board=finance',{waitUntil:'networkidle'})
 assert.equal(await visitor.getByRole('link',{name:'Schedule monthly finance exports',exact:true}).count(),0)
 await capture(visitor,'board-without-withdrawn')
 await owner.goto(origin+'/app/moderation?state=awaiting_review',{waitUntil:'networkidle'})
 assert.equal(await owner.getByRole('heading',{name:'Email the weekly finance summary',exact:true}).count(),0)
 await capture(owner,'moderation-without-withdrawn')
 await send(`/api/public/requests/${request.slug}`,undefined,{},'GET',410)
 const activity=await json('/api/public/requester/activity',undefined,auth)
 assert.equal(activity.votes.length,0)
 assert.ok(activity.requests.find(item=>item.slug===pending.slug).withdrawnAt)
})
