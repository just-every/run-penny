import assert from 'node:assert/strict'
import {expect} from '@playwright/test'
import {shot,openRequestControls} from './requester-evidence.mjs'

/** Board lifecycle through the mounted settings and request controls; assertions run at desktop width. */
export async function proveBoardManagement(harness){
 const {origin,api}=harness,operator=await harness.operator(1440),review=operator.page
 const source='board-source',target='board-target',title='Preserve customer feedback across boards'
 async function screens(page,name){
  await shot(page,name,1440)
  await page.setViewportSize({width:390,height:844})
  try{await shot(page,name,390)}finally{await page.setViewportSize({width:1440,height:1000})}
 }
 async function settings(){await review.goto(origin+'/app/settings#settings-boards');await review.locator('#create-board input[name=name]').waitFor()}
 async function create(slug,name){
  const createForm=review.locator('#create-board form')
  await createForm.getByLabel('Name',{exact:true}).fill(name)
  await createForm.getByLabel('URL name',{exact:true}).fill(slug)
  const saved=review.waitForResponse(response=>new URL(response.url()).pathname==='/api/operator/boards'&&response.request().method()==='POST')
  await createForm.getByRole('button',{name:'Create board',exact:true}).click()
  assert.equal((await saved).status(),201)
  await form(name).getByLabel('Name',{exact:true}).waitFor()
 }
 const boardsSection=review.getByRole('region',{name:'Boards',exact:true})
 const form=name=>boardsSection.locator('form').filter({has:review.locator(`input[name=name][value="${name}"]`)})
 async function save(boardForm,slug){
  const saved=review.waitForResponse(response=>new URL(response.url()).pathname===`/api/operator/boards/${slug}`&&response.request().method()==='PATCH')
  await boardForm.getByRole('button',{name:'Save board',exact:true}).click()
  assert.equal((await saved).status(),200)
 }
 await settings();await create(source,'Customer ideas');await create(target,'Research feedback')
 await harness.explicitConsentBoard(source,review.request)
 await harness.explicitConsentBoard(target,review.request)
 const author=await harness.requester(1440,['synthetic-penny-board','example.test'].join('@'))
 const authority={Authorization:`Bearer ${author.token}`,'CF-Connecting-IP':author.clientAddress}
 const request=await (await api('/api/public/requests',{title,description:'Keep the existing discussion and demand together.',boardSlug:source,idempotencyKey:crypto.randomUUID()},authority)).json()
 await api(`/api/operator/moderation/${request.slug}`,{verdict:'approved',title,description:'Keep the existing discussion and demand together.',boardSlug:source,displayName:'Customer'},review.request)
 await api(`/api/public/requests/${request.slug}/follow`,{},authority)
 const comment=await (await api(`/api/public/requests/${request.slug}/comments`,{body:'This discussion must survive a board move.'},authority)).json()
 await api(`/api/operator/comments/${comment.id}/moderate`,{verdict:'approved',publicAuthorDisplayName:'Customer'},review.request)
 await settings()
 await form('Customer ideas').getByLabel('Name',{exact:true}).fill('Customer suggestions')
 await form('Customer ideas').getByLabel('Order',{exact:true}).fill('1')
 await save(form('Customer ideas'),source)
 await review.reload()
 await form('Research feedback').getByLabel('Order',{exact:true}).fill('0')
 await save(form('Research feedback'),target)
 await review.reload()
 await expect(form('Customer suggestions').getByLabel('Name',{exact:true})).toHaveValue('Customer suggestions')
 await expect(form('Customer suggestions').getByLabel('Order',{exact:true})).toHaveValue('1')
 const boards=await (await api('/api/public/boards')).json(),ordered=boards.filter(board=>[source,target].includes(board.slug))
 assert.deepEqual(ordered.map(board=>[board.slug,board.name]),[[target,'Research feedback'],[source,'Customer suggestions']])
 await screens(review,'board-settings')
 await author.page.goto(origin+'/portal/feedback')
 const navigation=author.page.getByRole('complementary',{name:'Boards',exact:true})
 await expect(navigation.getByRole('link',{name:/^Research feedback\b/})).toBeVisible()
 await expect(navigation.getByRole('link',{name:/^Customer suggestions\b/})).toBeVisible()
 await review.goto(origin+'/app/moderation')
 const card=review.locator('article').filter({has:review.getByRole('heading',{name:title,exact:true})})
 await openRequestControls(card)
 await card.getByLabel('Move to board',{exact:true}).fill(target)
 const moved=review.waitForResponse(response=>new URL(response.url()).pathname===`/api/operator/requests/${request.slug}/board`&&response.request().method()==='PATCH')
 await card.getByRole('button',{name:'Move request',exact:true}).click()
 assert.equal((await moved).status(),200)
 const detail=await (await api(`/api/public/requests/${request.slug}`)).json()
 assert.equal(detail.board.slug,target);assert.equal(detail.voteCount,1)
 assert.deepEqual(detail.comments.map(row=>[row.id,row.body]),[[comment.id,'This discussion must survive a board move.']])
 const context=await (await api(`/api/operator/requests/${request.slug}/context`,undefined,review.request)).json()
 assert.equal(context.demand.evidenceCount,1)
 assert.ok((await (await api('/api/public/requester/activity',undefined,authority)).json()).follows.some(row=>row.slug===request.slug))
 await settings()
 await form('Research feedback').getByRole('checkbox',{name:'Archive board',exact:true}).check()
 await save(form('Research feedback'),target)
 await review.reload();await expect(form('Research feedback').getByRole('checkbox',{name:'Archive board',exact:true})).toBeChecked()
 await screens(review,'board-archived-settings')
 await author.page.goto(origin+'/portal/feedback')
 await expect(navigation.getByRole('link',{name:/^Customer suggestions\b/})).toBeVisible()
 await expect(navigation.getByRole('link',{name:/^Research feedback\b/})).toHaveCount(0)
 await screens(author.page,'board-archived-navigation')
 await author.page.goto(origin+`/portal/feedback/${request.slug}`)
 await expect(author.page.getByRole('heading',{name:title,exact:true})).toBeVisible()
 await expect(author.page.getByText('This discussion must survive a board move.',{exact:true})).toBeVisible()
 await screens(author.page,'board-archived-request')
 const refused=await fetch(origin+'/api/public/requests',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...authority},body:JSON.stringify({title:'Fresh valid request',description:'A verified requester cannot submit to this archived board.',boardSlug:target,emailUpdates:true,idempotencyKey:crypto.randomUUID()})})
 assert.equal(refused.status,409);assert.equal((await refused.json()).error,'board_unavailable')
 harness.assertNoRateLimits();harness.assertNoBrowserDiagnostics()
 console.log('PROBE REQ-018 browser: mounted settings create, rename, reorder, archive and request move -> saved; archived navigation removed, published URL retained and fresh submission refused 409; screens at 1440 and 390')
 await author.context.close();await operator.context.close()
 return {boardsCreated:true,renamed:true,reordered:true,movedWithParticipation:true,archivedNavigationRemoved:true,archivedUrlRetained:true,archivedSubmissionRefused:true}
}
