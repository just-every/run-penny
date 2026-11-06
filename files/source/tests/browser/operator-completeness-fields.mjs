import {publishFieldFixtures} from './operator-field-public-proof.mjs'
import assert from 'node:assert/strict'
import { entities,proofId } from './operator-completeness-data.mjs'
import {generatedOperatorTransport,generatedHeaders} from './operator-completeness-transport.mjs'
import { api } from './operator-completeness-auth.mjs'
async function openField(page,name) {
 await page.waitForLoadState('networkidle')
 const field=page.getByLabel(name,{exact:true})
 await field.waitFor({state:'attached'})
 const disclosures=field.locator('xpath=ancestor::details')
 for(let i=0;i<await disclosures.count();i++){const disclosure=disclosures.nth(i);if(await disclosure.getAttribute('open')===null)await disclosure.locator(':scope > summary').click()}
 await field.waitFor({state:'visible'})
 return field
}
export async function reviewCustomFields({page,peer,origin,capture,db}) {
 const definitions=[]
 for(const [entity,,path,kind] of entities) {
  await page.goto(origin+'/app/settings')
  await page.waitForLoadState('networkidle')
  const section=page.getByRole('region',{name:'Private custom fields',exact:true})
  const createForm=section.locator('form').filter({has:page.getByRole('button',{name:'Create field',exact:true})})
  // The selector is server-rendered; the create form requires the hydrated resource.
  await createForm.getByRole('button',{name:'Create field',exact:true}).waitFor()
  await section.getByLabel('Custom field entity type',{exact:true}).selectOption(entity)
  await createForm.getByRole('heading',{name:`Create a field for ${entity==='roadmapItem'?'roadmap item':entity}`,exact:true}).waitFor()
  await section.getByLabel('New field name',{exact:true}).fill(`customproof-${entity}`)
  await createForm.getByRole('combobox',{name:'Field type',exact:true}).selectOption('text')
  const created=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/operator/settings/custom-fields'&&r.request().method()==='POST')
  await section.getByRole('button',{name:'Create field',exact:true}).click()
  const response=await created;assert.equal(response.status(),201)
  const definition=await response.json();assert.equal(definition.entityType,entity,'[DATA-004] definition created for the selected entity');definitions.push(definition)
  const form=section.locator('form').filter({has:page.getByLabel('Field name',{exact:true})}).filter({has:page.locator(`input[value="customproof-${entity}"]`)})
  await form.getByLabel('Field name',{exact:true}).fill(`customproof-edited-${entity}`)
  const edited=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/operator/settings/custom-fields/${definition.id}`&&r.request().method()==='PATCH')
  await form.getByRole('button',{name:'Save field definition',exact:true}).click()
  assert.equal((await edited).status(),200,'[DATA-004] settings edits real definition')
  const recordPath=['account','decision','release'].includes(entity)?`${path}/proof-${entity}-00`:`${path}${path.includes('?')?'&':'?'}item=${proofId(kind)}`
  await page.goto(origin+recordPath)
  const field=await openField(page,`customproof-edited-${entity}`)
  await field.fill(`customproof-value-${entity}`)
  const valueForm=field.locator('xpath=ancestor::form[1]')
  const saved=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/operator/custom-fields/${entity}/${definition.id}/${proofId(kind)}`&&r.request().method()==='PUT')
  await valueForm.getByRole('button',{name:'Save field',exact:true}).click()
  assert.equal((await saved).status(),200)
  await page.reload();await openField(page,`customproof-edited-${entity}`);assert.equal(await field.inputValue(),`customproof-value-${entity}`)
  const second=await (await api(peer,`/api/operator/custom-fields/${entity}/${proofId(kind)}`)).json()
  assert.equal(second.find(row=>row.id===definition.id).value,`customproof-value-${entity}`,'[DATA-004] another native operator reads persisted value')
  await capture(`DATA-004-${entity}-persisted`,page)
  await field.fill('')
  const emptied=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/operator/custom-fields/${entity}/${definition.id}/${proofId(kind)}`&&r.request().method()==='PUT')
  await valueForm.getByRole('button',{name:'Save field',exact:true}).click()
  assert.equal((await emptied).status(),200)
  const empty=await (await api(page,`/api/operator/custom-fields/${entity}/${proofId(kind)}`)).json()
  assert.equal(empty.find(row=>row.id===definition.id).value,'')
  const clearedResponse=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/operator/custom-fields/${entity}/${definition.id}/${proofId(kind)}`&&r.request().method()==='PUT')
  await valueForm.getByRole('button',{name:`Clear customproof-edited-${entity}`,exact:true}).click()
  assert.equal((await clearedResponse).status(),200)
  await valueForm.getByText('Value cleared.',{exact:true}).waitFor()
  const cleared=await (await api(page,`/api/operator/custom-fields/${entity}/${proofId(kind)}`)).json()
  assert.equal(cleared.find(row=>row.id===definition.id).value,null)
  assert.equal(cleared.find(row=>row.id===definition.id).hasValue,true,'cleared value distinguished from never recorded')
 }
 // Typed boundary probes use the same native routes, with one definition per type.
 for(const [fieldType,value,invalid] of [['number',0,'0'],['boolean',false,'false'],['date','2026-10-13','2026-02-30']]) {
  const response=await api(page,'/api/operator/settings/custom-fields',{entityType:'account',name:`customproof-${fieldType}`,fieldType})
  assert.equal(response.status(),201);const definition=await response.json()
  const path=`/api/operator/custom-fields/account/${definition.id}/${proofId(6)}`
  assert.equal((await api(page,path,{value},'PUT')).status(),200)
  assert.equal((await api(page,path,{value:invalid},'PUT')).status(),400,'[DATA-004] wrong type/impossible calendar refused')
  assert.equal((await api(page,`/api/operator/custom-fields/request/${definition.id}/${proofId(1)}`,{value},'PUT')).status(),409,'[DATA-004] cross-entity definition refused')
  assert.equal((await api(page,`/api/operator/custom-fields/account/${definition.id}/nonexistent`,{value},'PUT')).status(),404)
  const fields=await (await api(peer,`/api/operator/custom-fields/account/${proofId(6)}`)).json()
  assert.equal(fields.find(row=>row.id===definition.id).value,value)
 }
 await publishFieldFixtures({page,db,definitions,capture})
 const anonymous=await page.context().browser().newContext()
 try {
  for(const path of ['/','/portal/feedback','/portal/roadmap','/portal/updates','/api/public/requests','/api/public/roadmap','/api/public/releases']) {
   const response=await anonymous.request.get(origin+path)
   assert.equal(response.status(),200,'[DATA-004] public privacy probe opens a real document/API')
   const body=await response.text()
   assert.doesNotMatch(body,/privateproof|customproof/,'[DATA-004] persisted definitions/values absent from public API/document/hydration')
   const title=({'/api/public/requests':'Public field request','/api/public/roadmap':'Public field roadmap','/api/public/releases':'Public field release'})[path]
   if(title)assert.ok(body.includes(title),'[DATA-004] privacy assertion reads a nonempty published projection')
  }
  const generated=await anonymous.request.get(origin+await generatedOperatorTransport(),{headers:generatedHeaders(origin)})
  assert.doesNotMatch(await generated.text(),/privateproof|customproof/,'[DATA-004] anonymous generated private field read denied')
 }finally{await anonymous.close()}
 const audit=await db.prepare("SELECT actor_id,entity_id,occurred_at FROM audit_entries WHERE action='custom_field.value_cleared' AND entity_id=?").bind(proofId(6)).first()
 assert.equal(audit?.entity_id,proofId(6));assert.ok(audit.actor_id&&Number.isFinite(Date.parse(audit.occurred_at)),'[BASE-OPS-005] actual value clear retained audit')
}
