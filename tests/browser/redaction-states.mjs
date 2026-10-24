import assert from 'node:assert/strict'

export async function checkRedactionStates({page,runtime,goto,capture,panel,patterns,root,oldId}){
 const progress=state=>panel.locator(`[data-redaction-state="${state}"]`)
 const read=async id=>{const response=await page.request.get(runtime.origin+root+(id?`/runs/${id}`:''));assert.equal(response.status(),200);return response.json()}
 async function preview(button){
  const response=page.waitForResponse(r=>r.url().endsWith(root+'/preview')&&r.request().method()==='POST')
  await button.click();const started=await response;assert.equal(started.status(),202)
  const run=await started.json();assert.equal(run.state,'previewing');assert.equal(run.canResume,false)
  await progress('previewing').getByRole('progressbar').waitFor()
  return run
 }
 async function settle(run){
  // Cron is the production worker entry; each event advances bounded real pages.
  for(let step=0;step<80&&(await read(run.id)).state==='previewing';step++)await runtime.schedule()
  const ready=await read(run.id);assert.equal(ready.state,'ready');assert.equal(ready.canResume,false)
  await progress('ready').getByRole('status').waitFor()
  return ready
 }
 const first=await preview(panel.getByRole('button',{name:'Preview stored evidence redaction',exact:true}))
 await capture('AI-008-reapply-previewing')
 const stalePlan=await settle(first)
 // A second owner-tab write invalidates the persisted plan; reload must not offer confirm.
 const settings=await read()
 assert.equal((await page.request.put(runtime.origin+root,{headers:{Origin:runtime.origin},data:{enabled:settings.enabled,kinds:settings.kinds,patterns:settings.patterns}})).status(),200)
 assert.equal((await read(first.id)).state,'stale')
 await page.reload();await progress('stale').getByRole('status').waitFor()
 assert.equal(await panel.getByRole('form',{name:'Confirm stored redaction'}).count(),0)
 assert.equal(await panel.getByRole('button',{name:'Resume redaction'}).count(),0)
 assert.equal(await progress('stale').getByRole('button').count(),1)
 assert.equal((await read()).latestRun.canResume,false)
 assert.equal((await page.request.post(runtime.origin+root+'/reapply',{headers:{Origin:runtime.origin},data:{planHash:stalePlan.planHash,confirmIrreversible:true}})).status(),409)
 await capture('AI-008-stale')
 const run=await preview(panel.getByRole('button',{name:'Preview again',exact:true})),ready=await settle(run)
 assert.equal(ready.changes,1)
 assert.equal(await patterns.inputValue(),'ACCOUNT-[0-9]{4}')
 const changing=ready.places.filter(place=>!place.blocked&&place.changes>0),unchanged=ready.places.filter(place=>place.blocked||!place.changes)
 const wording=ready.places.find(place=>place.table==='evidence_versions')
 assert.ok(wording);assert.equal(wording.records,2);assert.equal(wording.changes,1)
 assert.equal(await panel.locator('[data-redaction-place]:visible').count(),changing.length)
 const fold=panel.locator('[data-redaction-unchanged]'),summary=fold.locator('summary')
 assert.ok((await summary.boundingBox()).height>=44)
 const apply=panel.getByRole('button',{name:'Redact stored evidence permanently',exact:true})
 assert.equal(await apply.isDisabled(),true)
 await capture('AI-008-ready')
 await summary.click()
 for(const place of ready.places){
  const row=panel.locator(`[data-redaction-place="${place.table}"]`)
  await row.waitFor()
  assert.equal(Number(await row.getAttribute('data-records')),place.records)
  assert.equal(await row.getAttribute('data-blocked'),String(place.blocked))
  assert.equal(await row.getAttribute('data-changes'),place.changes===null?'':String(place.changes))
  if(place.blocked)assert.equal(place.changes,null)
 }
 assert.equal(await fold.locator('[data-redaction-place]').count(),unchanged.length)
 assert.equal(await fold.getByRole('link',{name:'Data',exact:true}).getAttribute('href'),'/app/data')
 // Open the linked product destination and return without losing the ready plan.
 const data=await page.context().newPage();assert.equal((await data.goto(runtime.origin+'/app/data')).status(),200);await data.getByRole('main').waitFor();await data.close()
 await capture('AI-008-reapply-unchanged-places');await summary.click()
 await panel.getByRole('form',{name:'Confirm stored redaction'}).getByRole('checkbox').check()
 assert.equal(await apply.isEnabled(),true)
 await capture('AI-008-reapply-confirmed')
 const applied=page.waitForResponse(r=>r.url().endsWith(root+'/reapply')&&r.request().method()==='POST')
 await apply.click();const appliedResponse=await applied;assert.equal(appliedResponse.status(),202)
 const running=await appliedResponse.json();assert.equal(running.state,'running')
 await progress('running').getByRole('progressbar').waitFor()
 await capture('AI-008-reapply-running')
 // A worker with revoked captured authority fails before changing a page.
 // The live owner's route can resume that same committed cursor with current authority.
 await runtime.db.prepare('UPDATE penny_redaction_runs SET operator_version=operator_version-1 WHERE id=?').bind(running.id).run()
 await runtime.schedule()
 const failed=await read(running.id);assert.equal(failed.state,'failed');assert.equal(failed.canResume,true);assert.equal(failed.changed,0)
 await page.reload();await progress('failed').getByRole('status').waitFor()
 const resumed=page.waitForResponse(r=>r.url().endsWith(`/runs/${running.id}/resume`)&&r.request().method()==='POST')
 await panel.getByRole('button',{name:'Resume redaction',exact:true}).click()
 const resumedResponse=await resumed;assert.equal(resumedResponse.status(),202)
 const resuming=await resumedResponse.json();assert.equal(resuming.state,'running');assert.equal(resuming.changed,failed.changed)
 await progress('running').getByRole('progressbar').waitFor();await capture('AI-008-resuming')
 for(let step=0;step<80&&(await read(running.id)).state==='running';step++)await runtime.schedule()
 const complete=await read(running.id);assert.equal(complete.state,'complete');assert.equal(complete.changed,1)
 await progress('complete').getByRole('status').waitFor()
 await runtime.schedule();assert.equal((await read(running.id)).changed,complete.changed)
 assert.equal(await runtime.db.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(oldId).first('wording'),'Prior captured account [REDACTED:custom].')
 await capture('AI-008-done')
}
