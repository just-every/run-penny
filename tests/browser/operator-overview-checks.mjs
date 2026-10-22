import assert from 'node:assert/strict'

export async function checkEmptyOverview(page) {
 for(const [section,href] of [['decisions','/app/decisions'],['evidence','/app/feedback'],['roadmap','/app/decisions'],['releases','/app/releases']]) {
  const region=page.locator(`[aria-labelledby="overview-${section}"]`)
  assert.equal(await region.locator('a').count(),1,`[OPS-003] empty ${section} offers its creating action`)
  assert.equal(await region.locator('a').getAttribute('href'),href)
  assert.ok((await region.getByRole('heading').last().innerText()).length>0,`[OPS-003] empty ${section} explains its absence`)
 }
}

export async function checkPopulatedOverview({page,db,goto,capture}) {
 const response=await page.request.get(new URL('/api/operator/overview',page.url()).href)
 assert.equal(response.status(),200)
 const overview=await response.json()
 assert.deepEqual(overview.decisions.map(row=>row.id),['attention-decision'],'[OPS-003] ready decision is listed')
 assert.deepEqual(overview.unreviewedEvidence.map(row=>row.id),['attention-evidence'],'[OPS-003] unreviewed evidence is listed')
 assert.deepEqual(overview.roadmap.map(row=>row.id).sort(),['attention-planned','attention-progress'],'[OPS-003] Planned and In progress are the active roadmap')
 assert.deepEqual(overview.recentReleases.map(row=>row.id),['attention-published-release'],'[OPS-003] drafts and releases older than 30 days are excluded')
 assert.equal(overview.recentReleases[0].outcomeTotal,1,'[OPS-003] release total counts the current outcome once across revisions')
 for(const [section,href] of [['decisions','/app/decisions/attention-decision'],['roadmap','/app/roadmap'],['releases','/app/releases/attention-published-release']])assert.ok(await page.locator(`[aria-labelledby="overview-${section}"] a[href="${href}"]`).count()>0,`[OPS-003] ${section} opens the listed records`)
 assert.equal(await page.locator('[aria-labelledby="overview-releases"] a').count(),1)
 assert.ok((await page.locator('[aria-labelledby="overview-releases"]').innerText()).includes('1 recorded outcome'))
 await db.prepare("UPDATE decisions SET state='review_due' WHERE id='attention-decision'").run()
 try {
  await goto('/app/overview')
  const link=page.getByRole('link',{name:'1 decision due for review',exact:true})
  await link.waitFor()
  assert.equal(await link.getAttribute('href'),'/app/decisions','[OPS-003] due figure opens its records')
  const due=await (await page.request.get(new URL('/api/operator/overview',page.url()).href)).json()
  assert.deepEqual(due.decisions.map(row=>[row.id,row.state]),[['attention-decision','review_due']],'[OPS-003] review-due records remain visible')
  assert.equal(await page.locator('[aria-labelledby="overview-decisions"] a[href="/app/decisions/attention-decision"]').count(),1)
  await capture('overview-review-due')
 } finally {
  await db.prepare("UPDATE decisions SET state='ready' WHERE id='attention-decision'").run()
  await goto('/app/overview')
 }
}
