import assert from 'node:assert/strict'
import {generatedOperatorTransport,generatedHeaders} from './operator-completeness-transport.mjs'
import { entities,marker,proofId } from './operator-completeness-data.mjs'
import { api } from './operator-completeness-auth.mjs'
const fields={requests:['requesttitle','requestdescription'],evidence:['evidencewording'],decisions:['decisionquestion','decisionrationale'],roadmap:['roadmaptitle','roadmapsummary'],releases:['releasetitle','releasebody'],accounts:['accountname'],requesters:['requestername','requesteremail']}
export async function reviewPrivateSearch({page,peer,origin,capture,checks,width}) {
 const hierarchy=[]
 for(const [kind,parent] of [['product',null],['component',0],['feature',1]]) {
  const name=marker(`${kind}name`),response=await api(page,`/api/operator/hierarchy/${kind}`,{name,...(parent===null?{}:{parentId:hierarchy[parent].id})})
  assert.equal(response.status(),201,'[OPS-004] native hierarchy creation')
  hierarchy.push({id:(await response.json()).id,entity:kind==='product'?'products':kind==='component'?'components':'features',name})
 }
 await page.goto(origin+'/app/search')
 await page.getByLabel('Search Penny',{exact:true}).fill('privateproof')
 const started=performance.now()
 await page.getByRole('button',{name:'Search',exact:true}).click()
 await page.getByRole('link',{name:marker('accountname'),exact:true}).waitFor()
 checks.push({label:'OPS-004-bounded-first-page',width,milliseconds:Math.round(performance.now()-started),scope:'small 392-record fixture; not capacity p95'})
 await capture('OPS-004-global-search',page)
 if(width===1440) {
  const mixed=await (await api(page,'/api/operator/search?q=privateproof')).json()
  assert.equal(mixed.total,10,'[OPS-004] new hierarchy and existing record types share one search')
  assert.deepEqual(mixed.items.map(row=>row.entity),['accounts','components','decisions','evidence','features','products','releases','requesters','requests','roadmap'],'[OPS-004] unchanged alphabetical entity ranking')
  for(const record of hierarchy) {
   assert.deepEqual(mixed.items.filter(row=>row.entity===record.entity).map(({id,title})=>({id,title})),[{id:record.id,title:record.name}])
   for(const q of [record.name,record.name.slice(7)]) {
    const result=await (await api(page,'/api/operator/search?'+new URLSearchParams({q,entity:record.entity}))).json()
    assert.equal(result.total,1)
    assert.equal(result.items[0].id,record.id)
    assert.equal(result.items[0].entity,record.entity)
    assert.equal(result.items[0].href,`/app/features#${record.entity}-${record.id}`)
    const global=await (await api(page,'/api/operator/search?'+new URLSearchParams({q}))).json()
    assert.equal(global.total,1,'[OPS-004] full and partial names work without a type filter')
    assert.deepEqual(global.items.map(({id,entity,title,href})=>({id,entity,title,href})),[{id:record.id,entity:record.entity,title:record.name,href:`/app/features#${record.entity}-${record.id}`}])
    const peerResult=await api(peer,'/api/operator/search?'+new URLSearchParams({q}))
    assert.equal(peerResult.status(),200,'[OPS-004] active peer keeps native hierarchy search admission')
    assert.deepEqual((await peerResult.json()).items,global.items)
    assert.equal((await api(peer,global.items[0].href)).status(),200,'[OPS-004] peer can open each returned hierarchy record')
    await page.getByLabel('Search Penny',{exact:true}).fill(q)
    await page.getByRole('button',{name:'Search',exact:true}).click()
    await page.waitForURL(url=>url.searchParams.get('q')===q)
    await page.getByRole('link',{name:record.name,exact:true}).waitFor()
    assert.equal(await page.getByRole('link',{name:record.name,exact:true}).getAttribute('href'),global.items[0].href,'[OPS-004] full and partial name form results retain the record destination')
   }
   const typeLabel=record.entity[0].toUpperCase()+record.entity.slice(1)
   await page.getByRole('navigation',{name:'Search record types'}).getByRole('link',{name:typeLabel,exact:true}).click()
   await page.waitForURL(url=>url.searchParams.get('entity')===record.entity)
   assert.equal(new URL(page.url()).searchParams.get('q'),record.name.slice(7),'[OPS-004] hierarchy type selection retains the search wording')
   assert.equal(await page.getByRole('navigation',{name:'Search record types'}).getByRole('link',{name:typeLabel,exact:true}).getAttribute('aria-current'),'page')
   await page.getByRole('link',{name:record.name,exact:true}).waitFor()
   await page.getByRole('navigation',{name:'Search record types'}).getByRole('link',{name:'All',exact:true}).click()
   await page.waitForURL(url=>!url.searchParams.has('entity'))
  }
 }
 // Equal names are separate records; opening either result must preserve its identity.
 const duplicateResponse=await api(page,'/api/operator/hierarchy/product',{name:hierarchy[0].name})
 assert.equal(duplicateResponse.status(),201,'[OPS-004] native duplicate-name product creation')
 const duplicate={...hierarchy[0],id:(await duplicateResponse.json()).id,duplicate:true}
 if(width===1440) {
  const sameName=await (await api(page,'/api/operator/search?'+new URLSearchParams({q:duplicate.name}))).json()
  assert.equal(sameName.total,2,'[OPS-004] search retains both equal-name records')
  assert.deepEqual(sameName.items.map(({id,entity,title,href})=>({id,entity,title,href})),[hierarchy[0],duplicate].sort((a,b)=>a.id.localeCompare(b.id)).map(record=>({id:record.id,entity:record.entity,title:record.name,href:`/app/features#${record.entity}-${record.id}`})))
 }
 hierarchy.push(duplicate)
 await page.goto(origin+'/app/search?q=privateproof')
 // Capture the real record destinations at both widths; behavioural assertions run at desktop.
 for(const record of hierarchy) {
  const destination=`/app/features#${record.entity}-${record.id}`
  await page.getByRole('link',{name:record.name,exact:true}).and(page.locator(`a[href="${destination}"]`)).click()
  await page.waitForURL(url=>url.pathname==='/app/features'&&url.hash===`#${record.entity}-${record.id}`)
  const target=page.locator(`[id="${record.entity}-${record.id}"]`)
  await target.getByRole('heading',{name:record.name,exact:true}).waitFor()
  if(width===1440) {
   await page.waitForFunction(id=>document.activeElement?.id===id,`${record.entity}-${record.id}`)
   assert.equal(await target.evaluate(element=>document.activeElement===element),true,'[OPS-004] destination identifies and focuses the exact record')
   await page.reload()
   await page.waitForFunction(id=>document.activeElement?.id===id,`${record.entity}-${record.id}`)
   await target.getByRole('heading',{name:record.name,exact:true}).waitFor()
   const box=await target.boundingBox()
   assert.ok(box.y>=0&&box.y<page.viewportSize().height,'[OPS-004] the selected hierarchy record is scrolled into view')
  }
  await capture(`OPS-004-${record.entity}${record.duplicate?'-same-name':''}-destination`,page)
  await page.goto(origin+'/app/search?q=privateproof')
  await page.getByRole('link',{name:record.name,exact:true}).and(page.locator(`a[href="${destination}"]`)).waitFor()
 }

 // Cross the shared page boundary with native hierarchy records, then open a later result.
 const paged=[]
 for(let index=0;index<22;index++) {
  const name=marker(`pagedproduct${String(index).padStart(2,'0')}`)
  const response=await api(page,'/api/operator/hierarchy/product',{name})
  assert.equal(response.status(),201,'[OPS-004] native records populate mixed search pages')
  paged.push({id:(await response.json()).id,entity:'products',name})
 }
 await page.reload()
 if(width===1440) {
  const existing=[['accounts',6],['decisions',3],['evidence',2],['releases',5],['requesters',7],['requests',1],['roadmap',4]].map(([entity,kind])=>({entity,id:proofId(kind)}))
  const expected=[existing[0],hierarchy[1],existing[1],existing[2],hierarchy[2],...paged,...[hierarchy[0],duplicate].sort((a,b)=>a.id.localeCompare(b.id)),...existing.slice(3)]
  const seen=[]
  for(let number=1;number<=2;number++) {
   const response=await api(page,`/api/operator/search?q=privateproof&page=${number}`)
   assert.equal(response.status(),200)
   const result=await response.json(),slice=expected.slice((number-1)*25,number*25)
   assert.equal(result.total,33,'[OPS-004] total includes hierarchy and every existing record type')
   assert.deepEqual(result.items.map(({entity,id})=>({entity,id})),slice.map(({entity,id})=>({entity,id})),'[OPS-004] global ordering survives a page boundary inside products')
   await page.getByRole('navigation',{name:'List pages'}).getByRole('status').filter({hasText:`Page ${number} of 2`}).waitFor()
   const links=page.locator('main h2 a')
   assert.deepEqual(await links.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href'))),result.items.map(row=>row.href),'[OPS-004] rendered order and destinations match the mixed page')
   seen.push(...result.items.map(row=>row.id))
   if(number===1) {
    await page.getByRole('link',{name:'Next page',exact:true}).click()
    await page.waitForURL(url=>url.searchParams.get('page')==='2'&&url.searchParams.get('q')==='privateproof')
   }
  }
  assert.equal(new Set(seen).size,33,'[OPS-004] adjacent mixed pages have no missing or repeated identities')
 } else {
  await page.getByRole('link',{name:'Next page',exact:true}).click()
  await page.waitForURL(url=>url.searchParams.get('page')==='2')
 }
 await page.getByRole('link',{name:paged[21].name,exact:true}).waitFor()
 await capture('OPS-004-mixed-second-page',page)
 await page.getByRole('link',{name:paged[21].name,exact:true}).click()
 await page.locator(`[id="products-${paged[21].id}"]`).getByRole('heading',{name:paged[21].name,exact:true}).waitFor()
 if(width===1440)await page.waitForFunction(id=>document.activeElement?.id===id,`products-${paged[21].id}`)
 await capture('OPS-004-second-page-destination',page)
 await page.goto(origin+'/app/search?q=privateproof&page=2')
 await page.getByRole('navigation',{name:'Search record types'}).getByRole('link',{name:'Products',exact:true}).click()
 await page.waitForURL(url=>url.searchParams.get('entity')==='products'&&!url.searchParams.has('page'))
 if(width===1440) {
  await page.getByRole('link',{name:paged[0].name,exact:true}).waitFor()
  assert.equal(await page.locator('main h2 a').count(),24,'[OPS-004] switching type resets the shared page and retains every matching product')
 }

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
  for(const path of ['/','/portal/feedback','/portal/roadmap','/portal/updates','/api/public/requests','/api/public/roadmap','/api/public/releases']) {
   const response=await anonymous.request.get(origin+path)
   assert.equal(response.status(),200,'[OPS-004 DATA-004] public privacy probe opens a real document/API')
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
  assert.equal(await page.getByRole('combobox',{name:'Sort',exact:true}).inputValue(),'age')
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
  if(entity==='evidence')assert.equal(await page.getByRole('combobox',{name:'Sort',exact:true}).inputValue(),'observed','[EVID-005] full chronology retains observed-time sorting')
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
