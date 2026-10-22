import assert from 'node:assert/strict'
import {api} from './operator-completeness-auth.mjs'
import {entities,proofId} from './operator-completeness-data.mjs'

/** Publish customer-safe fixture records before probing custom-field exclusion. */
export async function publishFieldFixtures({page,db,definitions,capture}) {
 for(const [entity,,,kind] of entities) {
  const definition=definitions.find(row=>row.entityType===entity)
  const saved=await api(page,`/api/operator/custom-fields/${entity}/${definition.id}/${proofId(kind)}`,{value:`customproof-published-${entity}`},'PUT')
  assert.equal(saved.status(),200,'[DATA-004] a private value exists when public projections are read')
 }
 assert.equal((await api(page,'/api/operator/moderation/proof-request-00',{verdict:'approved',title:'Public field request',description:'Customer-safe field fixture.',boardSlug:'proof-board',displayName:'Public requester'})).status(),200)
 assert.equal((await api(page,`/api/operator/roadmap/${proofId(4)}/approve`,{publicTitle:'Public field roadmap',publicSummary:'Customer-safe roadmap fixture.',boardSlug:'proof-board',requestIds:[proofId(1)]})).status(),200)
 const settings=await (await api(page,'/api/operator/settings/status-roadmap')).json()
 assert.equal((await api(page,'/api/operator/settings/status-roadmap',{...settings.settings,source:'approved_items'},'PUT')).status(),200)
 // Seed an already-published release; publication itself is not this privacy proof.
 const now=new Date().toISOString()
 await db.batch([
  db.prepare("UPDATE release_versions SET title='Public field release',body='Customer-safe release fixture.',is_portal_current=1,publication_date=? WHERE id=?").bind(now,proofId(12)),
  db.prepare("UPDATE releases SET state='published',published_at=? WHERE id=?").bind(now,proofId(5)),
 ])
 await page.goto(new URL('/portal/feedback/proof-request-00',page.url()).href)
 await page.waitForLoadState('networkidle')
 await page.getByRole('heading',{name:'Public field request',exact:true}).waitFor()
 assert.doesNotMatch(await page.locator('body').innerText(),/privateproof|customproof/,'[DATA-004] a published request renders no private field or identity source value')
 await capture('DATA-004-published-field-exclusion',page)
}
