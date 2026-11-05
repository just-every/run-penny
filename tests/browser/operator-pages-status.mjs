import assert from 'node:assert/strict'

export async function reviewStatusDrafts({page,db,goto,capture}) {
 await db.prepare("UPDATE roadmap_publications SET public_title='Current approved promise' WHERE id='attention-approval'").run()
 await goto('/app/overview')
 await page.getByText('Needs you',{exact:true}).waitFor()
 assert.equal(await page.getByRole('link',{name:/unpublished status update/}).count(),0,'[ROAD-007 ROAD-008] stale drafts are not publishable Needs-you obligations')
 await goto('/app/roadmap')
 await page.getByRole('button',{name:'Discard stale draft',exact:true}).first().waitFor()
 assert.equal(await page.getByRole('button',{name:'Discard stale draft',exact:true}).count(),2)
 assert.equal(await page.getByRole('button',{name:'Publish status update',exact:true}).count(),0)
 await capture('stale-status-drafts')
 const discarded=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/discard')&&response.request().method()==='POST')
 await page.getByRole('button',{name:'Discard stale draft',exact:true}).first().click()
 assert.equal((await discarded).status(),200,'[ROAD-008] explicit stale-draft discard succeeds')
 await page.getByRole('status').filter({hasText:'Stale draft discarded.'}).waitFor()
 await page.getByRole('button',{name:'Discard stale draft',exact:true}).nth(1).waitFor({state:'detached'})
 await capture('discarded-stale-status-draft')
 const origin=new URL(page.url()).origin
 const post=async(path,data)=>page.request.post(origin+path,{data,headers:{Origin:origin}})
 const first=await db.prepare('SELECT id,slug,public_title title FROM requests WHERE author_operator_id IS NOT NULL AND published_at IS NOT NULL ORDER BY created_at DESC LIMIT 1').first()
 const created=await post('/api/operator/requests',{title:'synthetic-penny-status-request',description:'Working request',boardSlug:'attention-board',evidenceIds:[]})
 assert.equal(created.status(),201)
 const second=await created.json()
 assert.equal((await post(`/api/operator/moderation/${second.slug}`,{verdict:'approved',title:'Reporting export request',description:'Export each reporting step.',boardSlug:'attention-board',displayName:'Owner'})).status(),200)
 assert.equal((await post('/api/operator/roadmap/attention-planned/approve',{publicTitle:'Current approved promise',publicSummary:'Customer problem',boardSlug:'attention-board',requestIds:[first.id,second.id]})).status(),200)
 const mappedRequests=[[first,first.title],[second,'Reporting export request']]
 const beforeHistory=new Map()
 for(const [request] of mappedRequests){
  const response=await page.request.get(origin+`/api/public/requests/${request.slug}`)
  assert.equal(response.status(),200)
  const detail=await response.json()
  assert.deepEqual(detail.statusUpdates,[],'[ROAD-007] mapped public histories start with no published update')
  beforeHistory.set(request.id,detail.statusUpdates)
 }
 await page.reload();await page.waitForLoadState('networkidle')
 const card=page.locator('#roadmap-item-attention-planned')
 await card.getByText('Edit, approve or move',{exact:true}).click()
 const form=card.getByRole('form',{name:'Move roadmap item',exact:true})
 await form.getByLabel('New status',{exact:true}).selectOption('in_progress')
 await form.getByLabel('Reason',{exact:true}).fill('Start delivery under the current approved promise.')
 const moved=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/move')&&response.request().method()==='POST')
 await form.getByRole('button',{name:'Record move',exact:true}).click()
 const moveResponse=await moved
 assert.equal(moveResponse.status(),200,'[ROAD-007] a deliberate current-authority move prepares a new draft')
 const {transitionId}=await moveResponse.json()
 const expectedBody='Current approved promise: In progress\n\nCustomer problem'
 const stored=await db.prepare('SELECT * FROM roadmap_update_versions WHERE id=?').bind(transitionId).first()
 assert.equal(stored.title,'Current approved promise')
 assert.equal(stored.problem,'Customer problem')
 assert.equal(stored.public_status,'in_progress')
 assert.equal(stored.body,expectedBody)
 assert.equal(stored.published_at,null)
 const draftResponse=await page.request.get(origin+'/api/operator/roadmap-updates?status=pending')
 assert.equal(draftResponse.status(),200)
 const drafts=await draftResponse.json()
 assert.deepEqual(drafts.items.find(draft=>draft.id===transitionId),{id:transitionId,title:'Current approved promise',body:expectedBody,publishedAt:null,publicationState:'ready'},'[ROAD-007] operator draft projection carries only its safe content and publication state')
 for(const [request,title] of mappedRequests){
  const response=await page.request.get(origin+`/api/public/requests/${request.slug}`)
  assert.equal(response.status(),200)
  const detail=await response.json()
  assert.equal(detail.status,'in_progress','[ROAD-007] public status follows the move before update publication')
  assert.deepEqual(detail.statusUpdates,beforeHistory.get(request.id),'[ROAD-007] preparing a draft adds no public history')
  assert.ok(!JSON.stringify(detail).includes(transitionId),'[ROAD-007] unpublished version identity stays private')
  assert.ok(!JSON.stringify(detail).includes(expectedBody),'[ROAD-007] unpublished version body stays private')
  const publicPage=await page.context().newPage()
  try{
   assert.equal((await publicPage.goto(origin+`/portal/feedback/${request.slug}`)).status(),200)
   await publicPage.getByRole('heading',{name:title,exact:true}).waitFor()
   await publicPage.getByText('In progress',{exact:true}).first().waitFor()
   assert.equal(await publicPage.getByText(expectedBody,{exact:true}).count(),0,'[ROAD-007] portal renders no unpublished body')
   assert.ok(!(await publicPage.content()).includes(transitionId),'[ROAD-007] portal document contains no unpublished identity')
   await capture(`unpublished-status-history-${request===first?'first':'second'}`,publicPage)
  }finally{await publicPage.close()}
 }
 await page.getByRole('button',{name:'Publish status update',exact:true}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Publish status update',exact:true}).count(),1)
 await page.getByRole('heading',{name:'Current approved promise',exact:true}).waitFor()
 await capture('current-authority-status-draft')
 const published=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/publish')&&response.request().method()==='POST')
 await page.getByRole('button',{name:'Publish status update',exact:true}).click()
 const publication=await published
 assert.equal(publication.status(),200,'[ROAD-008] explicit publication succeeds')
 await page.getByRole('button',{name:'Publish status update',exact:true}).waitFor({state:'detached'})
 await capture('published-status-draft')
 const duplicate=await post(new URL(publication.url()).pathname,{})
 assert.equal(duplicate.status(),409,'[ROAD-008] the same published version visibly refuses another publication')
 assert.ok((await duplicate.json()).message,'[ROAD-008] refusal has a readable reason')
 for(const [request,title] of mappedRequests){
  const detail=await (await page.request.get(origin+`/api/public/requests/${request.slug}`)).json()
  assert.equal(detail.statusUpdates.length,1,'[ROAD-008] each mapped request receives exactly one history entry')
  assert.equal(detail.statusUpdates[0].body,expectedBody,'[ROAD-007 ROAD-008] only explicit publication reveals the prepared body')
  assert.equal(detail.statusUpdates[0].status,'in_progress')
  const publicPage=await page.context().newPage()
  try{
   await publicPage.goto(origin+`/portal/feedback/${request.slug}`)
   await publicPage.getByRole('heading',{name:title,exact:true}).waitFor()
   await publicPage.getByText(detail.statusUpdates[0].body,{exact:true}).waitFor()
   await capture(`mapped-status-history-${request===first?'first':'second'}`,publicPage)
  }finally{await publicPage.close()}
 }

}
