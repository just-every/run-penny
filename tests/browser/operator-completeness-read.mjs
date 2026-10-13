import assert from 'node:assert/strict'
import {generatedOperatorTransport,generatedHeaders} from './operator-completeness-transport.mjs'
import { entities,marker,proofId } from './operator-completeness-data.mjs'
import { api } from './operator-completeness-auth.mjs'
const fields={requests:['requesttitle','requestdescription'],evidence:['evidencewording'],decisions:['decisionquestion','decisionrationale'],roadmap:['roadmaptitle','roadmapsummary'],releases:['releasetitle','releasebody'],accounts:['accountname'],requesters:['requestername','requesteremail']}
export async function reviewPrivateSearch({page,peer,origin,capture,checks,width}) {
 await page.goto(origin+'/app/search')
 await page.getByLabel('Search Penny',{exact:true}).fill('privateproof')
 const started=performance.now()
 await page.getByRole('button',{name:'Search',exact:true}).click()
 await page.getByRole('link',{name:marker('accountname'),exact:true}).waitFor()
 checks.push({label:'OPS-004-bounded-first-page',width,milliseconds:Math.round(performance.now()-started),scope:'small 392-record fixture; not capacity p95'})
 await capture('OPS-004-global-search',page)
 for(const [entity,names] of Object.entries(fields))for(const name of names) {
  const path='/api/operator/search?q='+marker(name)
  for(const actor of [page,peer]) {
   const response=await api(actor,path);assert.equal(response.status(),200)
   const result=await response.json()
   assert.equal(result.total,1,`[OPS-004] field-only marker ${name}`)
   assert.equal(result.items[0].entity,entity)
   const target=await actor.context().request.get(new URL(result.items[0].href,origin).href)
   assert.equal(target.status(),200,`[OPS-004] ${entity} result opens real record`)
  }
 }
 const anonymous=await page.context().browser().newContext()
 try {
  const generated=await anonymous.request.get(origin+await generatedOperatorTransport(),{headers:generatedHeaders(origin)})
  assert.doesNotMatch(await generated.text(),/privateproof|customproof/,'[OPS-004 DATA-004] anonymous generated private loader discloses no fields')
  for(const path of ['/api/operator/search?q=privateproof','/api/operator/accounts','/app/search']) {
   const response=await anonymous.request.get(origin+path,{maxRedirects:0})
   assert.ok([302,303,401].includes(response.status()),`[OPS-004] anonymous private read denied ${path}`)
   assert.doesNotMatch(await response.text(),/privateproof/)
  }
  for(const path of ['/','/portal/feedback','/portal/roadmap','/portal/releases','/api/public/requests','/api/public/roadmap','/api/public/releases']) {
   const response=await anonymous.request.get(origin+path)
   assert.doesNotMatch(await response.text(),/privateproof|customproof/,'[OPS-004 DATA-004] public documents/API contain no private fixture fields')
  }
 }finally{await anonymous.close()}
 await page.getByLabel('Search Penny',{exact:true}).fill('missing-proof-no-match')
 await page.getByRole('button',{name:'Search',exact:true}).click()
 await page.getByText('No records match this search.',{exact:true}).waitFor()
 await capture('OPS-004-empty-search',page)
}
export async function reviewDurableLists({page,origin,capture}) {
 for(const [,entity,path,kind] of entities) {
  const query='tag=proof-tag&sort=age'
  const pages=[]
  for(let number=1;number<=3;number++) {
   const response=await api(page,`/api/operator/${entity}?${query}&page=${number}`)
   assert.equal(response.status(),200)
   const result=await response.json()
   assert.equal(result.total,53,`[REQ-028 EVID-009] ${entity} inherited/direct tag count`)
   pages.push(...result.items.map(row=>row.id))
  }
  assert.equal(new Set(pages).size,53,`[REQ-028 EVID-009] ${entity} adjacent pages no duplicates`)
  assert.deepEqual(pages,Array.from({length:53},(_,i)=>proofId(kind,i)),`[REQ-028 EVID-009] ${entity} tied ages have stable identity order`)
  await page.goto(origin+path+(path.includes('?')?'&':'?')+query+'&page=2')
  await page.getByRole('link',{name:'Previous page',exact:true}).waitFor()
  assert.equal(await page.getByLabel('Tag',{exact:true}).inputValue(),'proof-tag')
  assert.equal(await page.getByLabel('Sort',{exact:true}).inputValue(),'age')
  await page.reload()
  assert.equal(await page.getByLabel('Tag',{exact:true}).inputValue(),'proof-tag')
  await page.getByRole('link',{name:'Next page',exact:true}).click()
  await page.waitForURL(url=>url.searchParams.get('page')==='3')
  await page.goBack();await page.waitForURL(url=>url.searchParams.get('page')==='2')
  await page.goForward();await page.waitForURL(url=>url.searchParams.get('page')==='3')
  await capture(`REQ-028-${entity}-durable-page`,page)
  await page.getByLabel('Tag',{exact:true}).fill('no-such-proof-tag')
  await page.getByRole('button',{name:'Apply filters',exact:true}).click()
  await page.waitForURL(url=>!url.searchParams.has('page')||url.searchParams.get('page')==='1')
  const zero=await (await api(page,`/api/operator/${entity}?tag=no-such-proof-tag`)).json()
  assert.equal(zero.total,0)
 }
 await page.goto(origin+'/app/overview?tag=proof-tag&sort=age&page=2')
 await page.getByRole('link',{name:'Previous page',exact:true}).waitFor()
 await page.reload();assert.equal(new URL(page.url()).searchParams.get('page'),'2')
 const overview=await (await api(page,'/api/operator/overview?tag=proof-tag&sort=age&page=2')).json()
 assert.equal(overview.counts.moderation,53,'[REQ-028] attention list uses real tag filter/count')
 assert.equal(overview.awaitingModeration.length,25,'[REQ-028] attention collection server page is bounded')
 assert.equal(overview.pagination.page,2)
 await capture('REQ-028-overview-durable-page',page)
 await page.goto(origin+'/app/overview?tag=proof-tag&sort=age&page=4')
 const exhausted=await (await api(page,'/api/operator/overview?tag=proof-tag&sort=age&page=4')).json()
 assert.deepEqual(exhausted.counts,overview.counts,'[REQ-028] global attention counts survive exhausted pages')
 assert.equal(exhausted.awaitingModeration.length,0)
 assert.equal(exhausted.unreviewedEvidence.length,0)
 const attention=page.locator('[aria-labelledby="overview-attention"]')
 await attention.getByRole('link',{name:`${overview.counts.moderation} requests awaiting moderation`,exact:true}).waitFor()
 await attention.getByRole('link',{name:`${overview.counts.evidence} unreviewed evidence items`,exact:true}).waitFor()
 await page.reload()
 await attention.getByRole('link',{name:`${overview.counts.moderation} requests awaiting moderation`,exact:true}).waitFor()
 await capture('REQ-028-overview-exhausted-page-attention',page)
 await reviewAccountCollections({page,origin,capture})

 const combined=new URLSearchParams({moderation:'awaiting_review',board:'proof-board',status:'unpublished',tag:'proof-tag',decision:'proof-decision-00',account:'proof-account-00',sort:'votes'})
 await page.goto(origin+'/app/moderation?'+combined)
 await page.getByRole('heading',{name:marker('requesttitle'),exact:true}).waitFor()
 const response=await api(page,'/api/operator/requests?'+combined),result=await response.json()
 assert.equal(result.total,1,'[REQ-028] all six request filters compose on unpublished queue')
 assert.equal(result.items[0].id,proofId(1))
 await capture('REQ-028-combined-request-filters',page)
 const merged=await api(page,'/api/operator/requests/proof-request-52/merge',{targetSlug:'proof-request-55'})
 assert.equal(merged.status(),200,'[REQ-028] real request merge succeeds')
 const retained=await (await api(page,`/api/operator/requests?item=${proofId(1,55)}&tag=proof-tag`)).json()
 assert.equal(retained.total,1,'[REQ-028] canonical request retains merged tag effects')
 for(const invalid of ['page=0','page=9999999999999999','sort=bogus','moderation=bogus','tag='+ 'x'.repeat(161)])assert.equal((await api(page,'/api/operator/requests?'+invalid)).status(),400,'[REQ-028] invalid list inputs refused')
}

async function reviewAccountCollections({page,origin,capture}) {
 const response=await api(page,'/api/operator/accounts/proof-account-00')
 assert.equal(response.status(),200)
 const account=await response.json()
 for(const [entity,preview,total,label] of [
  ['requests',account.requests,account.linkedRequestCount,'linked requests'],
  ['evidence',account.evidence,account.evidenceCount,'evidence items'],
  ['requesters',account.requesters,account.requesterCount,'linked requesters'],
  ['decisions',account.decisions,account.linkedDecisionCount,'linked decisions'],
 ]) {
  if(total===0)continue
  await page.goto(origin+'/app/customers/proof-account-00')
  const viewAll=page.getByRole('link',{name:`View all ${label}`,exact:true})
  await viewAll.waitFor()
  await viewAll.click()
  await page.waitForURL(url=>url.searchParams.get('account')===account.slug)
  await page.getByLabel('Account',{exact:true}).waitFor()
  assert.equal(await page.getByLabel('Account',{exact:true}).inputValue(),account.slug,'[EVID-005] account relationship filter is visible')
  await page.reload()
  assert.equal(await page.getByLabel('Account',{exact:true}).inputValue(),account.slug,'[EVID-005] filtered continuation survives reload')
  if(entity==='evidence')assert.equal(await page.getByLabel('Sort',{exact:true}).inputValue(),'observed','[EVID-005] full chronology retains observed-time sorting')
  const route=new URL(page.url()),ids=[]
  for(let number=1;number<=Math.ceil(total/25);number++) {
   const query=new URLSearchParams(route.search);query.set('page',String(number))
   const result=await (await api(page,`/api/operator/${entity}?${query}`)).json()
   assert.equal(result.total,total)
   ids.push(...result.items.map(row=>entity==='decisions'?row.slug:row.id))
  }
  assert.equal(new Set(ids).size,total,'[EVID-005] every relationship is accessible without duplicates')
  assert.ok(preview.every(row=>ids.includes(entity==='decisions'?row.slug:row.id)),'[EVID-005] preview and continuation use the same relationships')
  await capture(`EVID-005-account-${entity}-continuation`,page)
 }
 await page.goto(origin+'/app/customers/proof-account-00')
 await page.getByRole('link',{name:'View evidence, versions and private files',exact:true}).first().click()
 await page.waitForURL(url=>url.searchParams.get('item')===account.evidence[0].id)
 await page.locator(`[id="evidence-${account.evidence[0].id}"]`).waitFor()
}
