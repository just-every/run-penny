import assert from 'node:assert/strict'
import { contradicting, form, save } from './loopjourney-steps.mjs'

export function recoveryHttpErrors(itemId){
  return ['/api/operator/evidence',`/api/operator/roadmap/${itemId}/context`,'/api/operator/loop/options','/api/operator/releases/options'].map(path=>({path,status:500,count:1}))
}
export async function editingRecovery(page,origin,audit,commit){
  const base=`/api/operator/roadmap/${commit.itemId}`
  const context=async()=>{
    const response=await page.request.get(origin+base+'/context')
    assert.equal(response.status(),200,'[ROAD-002] native context remains available')
    return response.json()
  }
  const open=async()=>{
    await page.goto(origin+'/app/roadmap',{waitUntil:'networkidle'})
    await page.getByText('Edit, approve or move',{exact:true}).click()
  }
  await open()
  let edit=form(page,'Edit internal record')
  await edit.getByLabel(contradicting,{exact:true}).check()
  await save(page,edit,'Save',base)
  const before=(await context()).evidenceIds
  assert.equal(before.length,1,'[EVID-004] a native additional evidence association was saved')
  const failedEvidence=origin+'/api/operator/evidence'
  const failure=route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'test_only_read_failure'})})
  await page.route(failedEvidence,failure)
  try{
    await open()
    edit=form(page,'Edit internal record')
    await edit.getByText('Could not load linked evidence',{exact:true}).waitFor()
    assert.equal(await edit.getByRole('button',{name:'Save',exact:true}).isEnabled(),false,'[ROAD-002][EVID-004] failure cannot replace relations with empty input')
    await edit.getByLabel('Target window',{exact:true}).fill('Next quarter')
    let writes=0
    const count=request=>{if(new URL(request.url()).pathname===base&&request.method()==='PATCH')writes++}
    page.on('request',count)
    try{await edit.evaluate(form=>form.requestSubmit());await page.waitForTimeout(100)}finally{page.off('request',count)}
    assert.equal(writes,0,'[EVID-004] disabled submission emits no PATCH')
    assert.deepEqual((await context()).evidenceIds,before,'[EVID-004] failed read and unrelated edit preserve stored associations')
    await audit(page,'ROAD-002-evidence-failure-save-disabled')
  }finally{await page.unroute(failedEvidence,failure)}
  const reload=page.waitForResponse(response=>response.url()===failedEvidence&&response.status()===200)
  await edit.getByRole('button',{name:'Try again',exact:true}).click()
  await reload
  await edit.getByLabel(contradicting,{exact:true}).waitFor()
  assert.equal(await edit.getByLabel(contradicting,{exact:true}).isChecked(),true,'[EVID-004] retry restores the existing selection')
  await save(page,edit,'Save',base)
  const after=await context()
  assert.deepEqual(after.evidenceIds,before,'[EVID-004] successful unrelated edit preserves evidence links')
  assert.equal(after.item.target_window,'Next quarter','[ROAD-002] previously entered unrelated value survives retry')
  await audit(page,'ROAD-002-evidence-retry-and-save')

  for(const path of [base+'/context','/api/operator/loop/options','/api/operator/releases/options']){
    const url=origin+path,release=path.includes('/releases/')
    await page.route(url,failure)
    let scope
    try{
      if(release){await page.goto(origin+'/app/releases',{waitUntil:'networkidle'});scope=page.locator('form').filter({has:page.getByRole('heading',{name:'Create release draft',exact:true})})}
      else {await open();scope=page.locator('details').filter({has:page.getByText('Edit, approve or move',{exact:true})})}
      await scope.getByText(release?'Could not load release choices':'Could not load editing options',{exact:true}).waitFor()
      assert.equal(await scope.getByText(release?'Loading release choices…':'Loading editing options…',{exact:true}).count(),0,'[BASE-OPS-004] terminal failure is distinct from loading')
      if(release)assert.equal(await scope.getByRole('button',{name:'Save draft',exact:true}).isEnabled(),false)
      await audit(page,release?'REL-001-options-failure':path.endsWith('/context')?'ROAD-002-context-failure':'ROAD-002-choices-failure')
    }finally{await page.unroute(url,failure)}
    const loaded=page.waitForResponse(response=>response.url()===url&&response.status()===200)
    await scope.getByRole('button',{name:'Try again',exact:true}).click()
    await loaded
    await (release?scope.locator('select[name="authorOperatorId"]'):form(page,'Edit internal record')).waitFor()
    await audit(page,release?'REL-001-options-recovered':path.endsWith('/context')?'ROAD-002-context-recovered':'ROAD-002-choices-recovered')
  }
}
