import assert from 'node:assert/strict'

/** DOM acceptance for the decision and roadmap findings, on each caller viewport. */
export async function reviewDecisionPages({page,db,goto,capture,width}) {
  for(const state of ['ready','review_due']) {
    await db.prepare('UPDATE decisions SET state=? WHERE id=?').bind(state,'attention-decision').run()
    await goto('/app/decisions/attention-decision')
    await page.getByRole('link',{name:'record evidence in the Evidence inbox',exact:true}).waitFor()
    assert.equal(await page.getByRole('link',{name:'record evidence in the Evidence inbox',exact:true}).getAttribute('href'),'/app/feedback')
    await capture(`${state}-without-evidence`)
  }
  await db.prepare("UPDATE decisions SET state='ready' WHERE id='attention-decision'").run()
  const negativePage=await page.context().newPage(),negativeErrors=[],diagnostics=[]
  const origin=new URL(page.url()).origin,commitUrl=origin+'/api/operator/decisions/attention-decision/commit'
  let observed422=false
  negativePage.on('response',response=>{if(response.url()===commitUrl&&response.request().method()==='POST'&&response.status()===422)observed422=true})
  negativePage.on('pageerror',error=>negativeErrors.push(error.message))
  negativePage.on('request',request=>{if(new URL(request.url()).origin!==origin)negativeErrors.push('External request in negative validation page')})
  negativePage.on('console',message=>{
    if(message.type()!=='error')return
    if(observed422&&message.location().url===commitUrl&&message.text()==='Failed to load resource: the server responded with a status of 422 (Unprocessable Entity)')diagnostics.push({path:'/api/operator/decisions/attention-decision/commit',status:422,message:message.text()})
    else negativeErrors.push(message.text())
  })
  try {
    await negativePage.goto(origin+'/app/decisions/attention-decision')
    const commit=negativePage.getByRole('form',{name:'Commit decision',exact:true})
    // Owner choices load after the page renders and then apply the decision's owner; clear it only once they exist.
    await commit.locator('select[name="ownerOperatorId"] option').nth(1).waitFor({state:'attached'})
    await commit.getByLabel('Owner',{exact:true}).selectOption('')
    const [response]=await Promise.all([negativePage.waitForResponse(response=>response.url()===commitUrl&&response.request().method()==='POST'),commit.getByRole('button',{name:'Commit selected bet',exact:true}).click()])
    assert.equal(response.status(),422,'[DEC-004] intentional missing-field refusal')
    await commit.getByRole('alert').waitFor()
    for(const label of ['Selected bet','Rationale','Owner','Confidence','Review date','No viable alternative reason']) {
      const control=commit.getByLabel(label,{exact:false}).first()
      assert.equal(await control.getAttribute('aria-invalid'),'true',`[DEC-004] ${label} inline invalid at ${width}: ${await commit.getByRole('alert').innerText()}`)
      const error=await control.getAttribute('aria-describedby')
      assert.ok(error,`[DEC-004] ${label} associated error`)
      assert.equal(await negativePage.locator(`[id="${error}"]`).innerText(),`${label} is required.`)
    }
    await capture('negative-commit-required-fields',negativePage)
    assert.deepEqual(negativeErrors,[],'[DEC-004] negative phase has no application or unexpected network errors')
    assert.equal(diagnostics.length,1,'[DEC-004] exactly the observed intentional 422 diagnostic')
  } finally {await negativePage.close()}
  const now=new Date().toISOString()
  for(const id of ['page-account-one','page-account-two'])await db.prepare('INSERT INTO accounts(id,slug,name,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,id,id,now,now).run()
  await db.prepare("UPDATE evidence_items SET account_id='page-account-one' WHERE id='attention-evidence'").run()
  await db.prepare("UPDATE evidence_items SET account_id='page-account-two' WHERE id='second-evidence'").run()
  for(const [id,title] of [['page-bet-a','Selected approach'],['page-bet-b','Declined approach']])await db.prepare('INSERT INTO candidate_bets(id,decision_id,title,summary,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,'attention-decision',title,'An approach to compare',now,now).run()
  for(const [bet,evidence,stance] of [['page-bet-a','attention-evidence','supporting'],['page-bet-b','attention-evidence','supporting'],['page-bet-b','second-evidence','contradicting']])await db.prepare('INSERT INTO candidate_bet_evidence_links(candidate_bet_id,evidence_id,stance,created_at) VALUES(?,?,?,?)').bind(bet,evidence,stance,now).run()
  await db.prepare("UPDATE decisions SET state='committed',selected_candidate_bet_id='page-bet-a',title='Choose the approach that makes the delivery promise clear' WHERE id='attention-decision'").run()
  await db.prepare("UPDATE roadmap_items SET candidate_bet_id='page-bet-a' WHERE id='attention-planned'").run()
  await db.prepare("UPDATE roadmap_items SET candidate_bet_id='page-bet-b' WHERE id='attention-shipped'").run()
  await goto('/app/decisions/attention-decision')
  await page.getByText('1 affected account · 0 requesters',{exact:true}).waitFor()
  await page.getByText('2 affected accounts · 0 requesters',{exact:true}).waitFor()
  await page.getByText('Shared evidence and accounts count once in brief totals, even when linked to several bets.',{exact:false}).waitFor()
  assert.equal(await page.getByRole('heading',{name:'Supports (1)',exact:true}).count(),2)
  assert.equal(await page.getByRole('heading',{name:'Contradicts (1)',exact:true}).count(),1)
  assert.equal(await page.getByText('Supporting',{exact:true}).count(),2)
  assert.equal(await page.getByText('Contradicting',{exact:true}).count(),1)
  await capture('brief-counts-and-stances')
  for(const id of ['page-requester-one','page-requester-two'])await db.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,?,?,?)').bind(id,id,now,now).run()
  await db.prepare("UPDATE evidence_items SET requester_id='page-requester-one' WHERE id='attention-evidence'").run()
  await db.prepare("UPDATE evidence_items SET requester_id='page-requester-two' WHERE id='second-evidence'").run()
  await goto('/app/decisions/attention-decision')
  await page.getByText('1 affected account · 1 requester',{exact:true}).waitFor()
  await page.getByText('2 affected accounts · 2 requesters',{exact:true}).waitFor()
  await capture('brief-requester-count-grammar')
  await goto('/app/roadmap')
  const declined=page.locator('#roadmap-item-attention-shipped')
  await declined.getByText('Declined',{exact:true}).waitFor()
  assert.equal(await declined.getByText('Committed',{exact:true}).count(),0)
  const row=declined.locator('dd').filter({hasText:'Choose the approach that makes the delivery promise clear'})
  const size=await row.boundingBox()
  assert.ok(size&&size.width>=200,`[ROAD-002] readable Decision row at ${width}: ${size?.width}`)
  if(width===1440) {
    const wrapping=await row.locator('span').first().evaluate(element=>{
      const range=document.createRange();range.selectNodeContents(element)
      const lines=[...range.getClientRects()]
      const bounds=element.getBoundingClientRect()
      return {lines:lines.length,inside:lines.every(line=>line.left>=bounds.left-1&&line.right<=bounds.right+1)}
    })
    assert.ok(wrapping.lines<=3&&wrapping.inside,'[ROAD-002] desktop Decision title uses at most three full-width lines without clipping')
  }
  await capture('roadmap-decision-rows')
  await goto('/app/feedback')
  const recorder=page.getByRole('form',{name:'New evidence',exact:true})
  await recorder.getByLabel('Source',{exact:true}).selectOption('interview')
  await recorder.getByLabel('Original wording',{exact:true}).fill('Browser-local observed time')
  await recorder.getByLabel('Observed time',{exact:true}).fill('2026-10-08T09:15')
  await recorder.getByRole('button',{name:'Record evidence',exact:true}).click()
  await recorder.getByRole('status').waitFor()
  assert.equal(await recorder.getByLabel('Original wording',{exact:true}).inputValue(),'','[EVID-001] evidence form resets')
  const recorded=await db.prepare('SELECT e.observed_at,e.named_speaker,e.account_id FROM evidence_items e JOIN evidence_versions v ON v.evidence_id=e.id WHERE v.wording=?').bind('Browser-local observed time').first()
  assert.deepEqual(recorded,{observed_at:'2026-10-07T23:15:00.000Z',named_speaker:null,account_id:null},'[EVID-002] local observed input means its actual instant; optional provenance stays null')
  await capture('recorded-evidence')
  return {width,phase:'negative',diagnostics}
}
