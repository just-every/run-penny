import assert from 'node:assert/strict'
import {reviewRoadmapRecord} from './operator-roadmap-record.mjs'
import {reviewEvidenceFlow} from './operator-evidence-flow.mjs'

/** DOM acceptance for the decision and roadmap findings, on each caller viewport. */
export async function reviewDecisionPages({page,db,goto,capture,width}) {
  await reviewComparableBets({page,goto,capture,width})
  for(const state of ['ready','review_due']) {
    await db.prepare('UPDATE decisions SET state=? WHERE id=?').bind(state,'attention-decision').run()
    await goto('/app/decisions/attention-decision')
    await page.getByRole('link',{name:/in the Evidence inbox$/}).waitFor()
    assert.equal(await page.getByRole('link',{name:/in the Evidence inbox$/}).getAttribute('href'),'/app/feedback')
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
  await reviewEvidenceFlow({page,db,capture})
  await reviewRoadmapRecord({page,db,goto,capture})
  return {width,phase:'negative',diagnostics}
}

/** A native comparison stays in its original order as demand changes sides. */
async function reviewComparableBets({page,goto,capture,width}) {
  const origin=new URL(page.url()).origin
  const api=async(path,method='GET',data)=>{
    const response=await page.request.fetch(origin+path,{method,headers:{Origin:origin},...(data===undefined?{}:{data})})
    assert.equal(response.status(),method==='POST'&&!path.endsWith('/commit')?201:200,`[DEC-003] ${method} ${path}`)
    return response.json()
  }
  const decision=await api('/api/operator/decisions','POST',{question:'Which setup approach helps customers?',ownerOperatorId:'attention-operator'})
  const base=`/api/operator/decisions/${decision.id}`
  const createBet=(title,urgency)=>api(base+'/bets','POST',{title,summary:'A concrete setup approach',urgency,deliveryShape:'Small release',successMeasure:'Setup completes in ten seconds'})
  const a=await createBet('Guided setup','Now'),b=await createBet('Self-service setup','Later')
  const link=(evidence,bet,method='PUT')=>api(`/api/operator/evidence/${evidence}/links`,method,{target:'bet',targetId:bet,stance:'supporting'})
  const record=async(index,bet)=>{
    const name=`synthetic-penny-${index}`
    const account=await api('/api/operator/accounts','POST',{name,internalOwnerId:'attention-operator'})
    const evidence=await api('/api/operator/evidence','POST',{sourceType:'interview',wording:name,observedAt:`2026-01-0${index}T00:00:00Z`,accountId:account.id})
    await link(evidence.id,bet)
    return evidence
  }
  await record(1,a.id)
  const initial=await api(`/api/operator/decisions/${decision.slug}`),baseline=initial.bets.map(bet=>bet.id)
  const titles=new Map([[a.id,'Guided setup'],[b.id,'Self-service setup']])
  const alternatives=page.locator('[aria-labelledby="candidate-bets"]'),cards=alternatives.locator(':scope > div > section')
  const compare=async(label,expected)=>{
    const brief=await api(`/api/operator/decisions/${decision.slug}`)
    await goto(`/app/decisions/${decision.slug}`)
    await cards.last().getByRole('heading',{name:titles.get(baseline.at(-1)),exact:true}).waitFor()
    if(width===1440) {
      assert.deepEqual(brief.bets.map(bet=>bet.id),baseline,'[DEC-003] native bet order survives changed demand and urgency')
      assert.deepEqual(await cards.locator('h2').allTextContents(),baseline.map(id=>titles.get(id)),'[DEC-003] rendered alternatives retain the same identities and order')
      assert.doesNotMatch(await cards.allTextContents().then(text=>text.join(' ')),/\b(?:score|rank(?:ing|ed)?|priority points)\b/i,'[DEC-003] no computed score or ranking is displayed')
      for(const [id,support,accounts,urgency,latest] of expected) {
        const bet=brief.bets.find(candidate=>candidate.id===id),card=cards.filter({has:page.getByRole('heading',{name:titles.get(id),exact:true})})
        assert.deepEqual(bet.metrics,{supportingCount:support,contradictingCount:0,affectedAccountCount:accounts,affectedRequesterCount:0,latestSupportAt:latest})
        assert.deepEqual(Object.keys(bet).sort(),['id','title','summary','urgency','deliveryShape','successMeasure','assumptions','counterEvidence','accounts','evidence','metrics'].sort(),'[DEC-003] native projection has only separate dimensions and source context')
        assert.ok((await card.innerText()).includes(`${accounts} affected ${accounts===1?'account':'accounts'} · 0 requesters`))
        assert.equal(await card.getByText(`${support} supporting · 0 contradicting`,{exact:true}).count(),1)
        assert.equal(await card.locator('time').getAttribute('datetime'),latest)
        assert.deepEqual(await card.locator('dl dt').allTextContents(),['Urgency','Delivery shape','Success measure','Assumptions','Counter-evidence'])
        assert.deepEqual(await card.locator('dl dd').allTextContents(),[urgency,'Small release','Setup completes in ten seconds','Not recorded','Not recorded'])
      }
    }
    await capture(label)
  }
  // Nonempty support for both options also makes every rendered time check real.
  await record(2,b.id)
  const third=await record(3,a.id)
  await compare('comparable-bets-baseline',[[a.id,2,2,'Now','2026-01-03T00:00:00Z'],[b.id,1,1,'Later','2026-01-02T00:00:00Z']])
  await link(third.id,a.id,'DELETE');await link(third.id,b.id)
  await api(base+`/bets/${b.id}`,'PATCH',{title:'Self-service setup',summary:'A concrete setup approach',urgency:'Immediate',deliveryShape:'Small release',successMeasure:'Setup completes in ten seconds'})
  await compare('comparable-bets-changed-demand',[[a.id,1,1,'Now','2026-01-01T00:00:00Z'],[b.id,2,2,'Immediate','2026-01-03T00:00:00Z']])
  await api(base+'/commit','POST',{selectedCandidateBetId:a.id,rationale:'Accountable choice despite the larger alternative',ownerOperatorId:'attention-operator',confidence:'medium',reviewAt:'2026-12-01'})
  await compare('comparable-bets-committed',[[a.id,1,1,'Now','2026-01-01T00:00:00Z'],[b.id,2,2,'Immediate','2026-01-03T00:00:00Z']])
}
