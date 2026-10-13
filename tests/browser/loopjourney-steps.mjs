import assert from 'node:assert/strict'

export const requestTitle = 'Make onboarding progress visible'
export const supporting = 'We need to see onboarding progress without chasing support.'
export const contradicting = 'A dashboard alone will not help teams who need a weekly digest.'
export const question = 'Which onboarding improvement should we commit to?'
export const bets = ['Onboarding progress dashboard', 'Weekly onboarding digest']
export function form(page, title) { return page.getByRole('form', { name: title, exact: true }) }
export async function boundedStep(page, label, run, { timeout = 30_000, details = () => ({}) } = {}) {
  let timer
  const started = Date.now()
  console.log(`[E.1] ${label} started`)
  try {
    const result = await Promise.race([
      Promise.resolve().then(run),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeout}ms`)), timeout) }),
    ])
    console.log(`[E.1] ${label} passed (${Date.now()-started}ms)`)
    return result
  } catch (error) {
    const diagnostic = { phase: label, elapsedMs: Date.now()-started, document: new URL(page.url()).pathname, pageClosed: page.isClosed(), ...details() }
    console.error(`[E.1] Journey failure: ${JSON.stringify(diagnostic)}`)
    throw new Error(`${label} failed; diagnostics: ${JSON.stringify(diagnostic)}`, { cause: error })
  } finally { clearTimeout(timer) }
}
export async function save(page, scope, button, path) {
  const state = { path, method: null, status: null, responseReceived: false, requestFinished: false, requestFailed: false }
  const matches = request => new URL(request.url()).pathname === path && request.method() !== 'GET'
  const finished = request => { if(matches(request)) state.requestFinished = true }
  const failed = request => { if(matches(request)) state.requestFailed = true }
  page.on('requestfinished', finished)
  page.on('requestfailed', failed)
  try {
    const response = await boundedStep(page, `${button}: click and response`, async () => {
      const pending = page.waitForResponse(r => matches(r.request()), { timeout: 30_000 })
      // Observe both promises immediately, including when the click itself fails.
      const [, response] = await Promise.all([scope.getByRole('button', {name:button,exact:true}).click({timeout:30_000}), pending])
      Object.assign(state, { method: response.request().method(), status: response.status(), responseReceived: true })
      return response
    }, { details: () => state })
    // Response bodies have no Playwright deadline; a committed write must still
    // return its real JSON before this UI action can count as successful.
    const body = await boundedStep(page, `${button}: response JSON`, () => response.json(), { details: () => state })
    assert.equal(response.ok(),true,`[DEC-001/EVID-001/ROAD-001] UI action ${button} returned ${response.status()}: ${body.message ?? ''}`)
    return body
  } finally {
    page.off('requestfinished', finished)
    page.off('requestfailed', failed)
  }
}
export async function createBoard(operator, origin, audit) {
  await operator.goto(origin+'/app/settings',{waitUntil:'networkidle'})
  await operator.getByText('No boards yet',{exact:true}).waitFor()
  await audit(operator,'E.1-empty-feedback-settings')
  const board=operator.locator('form').filter({has:operator.getByRole('button',{name:'Create board',exact:true})})
  await board.getByLabel('Name',{exact:true}).fill('Onboarding')
  await board.getByLabel('URL name',{exact:true}).fill('onboarding')
  await save(operator,board,'Create board','/api/operator/boards')
  await operator.getByText('URL name: onboarding',{exact:false}).waitFor()
  assert.equal(await board.getByLabel('Name',{exact:true}).inputValue(),'','[REQ-001] board form clears')
  await audit(operator,'E.1-board-created')
}
export async function submitFeedback(requester, origin, audit) {
  await requester.goto(origin+'/portal/feedback/new',{waitUntil:'networkidle'})
  await requester.getByLabel('Title',{exact:true}).fill(requestTitle)
  await requester.getByLabel('Problem description',{exact:true}).fill(supporting)
  await requester.locator('select[name=board]').selectOption('onboarding')
  await requester.getByLabel('Email me updates',{exact:true}).check()
  await audit(requester,'E.1-requester-submit-form')
  const submitted=await save(requester,requester,'Send for review','/api/public/requests')
  await requester.getByRole('heading',{name:'Feedback is awaiting review',exact:true}).waitFor()
  await audit(requester,'E.1-feedback-awaiting-review')
  await requester.goto(origin+'/portal/feedback/activity',{waitUntil:'networkidle'})
  await requester.getByRole('button',{name:'Unfollow',exact:true}).waitFor()
  await audit(requester,'E.1-held-feedback-following')
  return submitted.slug
}
export async function moderateAndFollow(operator,requester,origin,audit) {
  await operator.goto(origin+'/app/moderation',{waitUntil:'networkidle'})
  const review=operator.locator('form').filter({has:operator.getByLabel('Public title',{exact:true})}).first()
  const pending=operator.waitForResponse(r=>new URL(r.url()).pathname.startsWith('/api/operator/moderation/')&&r.request().method()==='POST')
  await audit(operator,'E.1-moderation-held-request')
  await review.getByRole('button',{name:'Approve and publish',exact:true}).click()
  assert.equal((await pending).ok(),true,'[REQ-011] UI moderation publishes')
  await operator.getByText('Approved wording is now public.',{exact:true}).waitFor()
  await audit(operator,'E.1-request-approved')
  await requester.goto(origin+'/portal/feedback',{waitUntil:'networkidle'})
  await audit(requester,'E.1-requester-homepage')
  await requester.getByRole('link',{name:requestTitle,exact:true}).click()
  await requester.waitForLoadState('networkidle')
  const slug=new URL(requester.url()).pathname.split('/').at(-1)
  await requester.getByRole('button',{name:'Unfollow',exact:true}).waitFor()
  assert.equal(await requester.getByRole('button',{name:'Follow',exact:true}).count(),0,'[REQ-023/NOTIFY-001] submission permission follows the now-public request')
  await audit(requester,'E.1-requester-following')
  return slug
}
export async function recordEvidence(operator,origin,audit) {
  await operator.goto(origin+'/app/feedback',{waitUntil:'networkidle'})
  const recorder=form(operator,'New evidence')
  await recorder.getByLabel('Source',{exact:true}).selectOption('interview')
  await recorder.getByLabel('Original wording',{exact:true}).fill(contradicting)
  const now=new Date(); now.setMinutes(now.getMinutes()-now.getTimezoneOffset())
  await recorder.getByLabel('Observed time',{exact:true}).fill(now.toISOString().slice(0,16))
  await recorder.getByLabel('Named speaker (optional)',{exact:true}).fill('Local interview participant')
  await audit(operator,'E.1-second-evidence-form')
  await save(operator,recorder,'Record evidence','/api/operator/evidence')
  await operator.getByText(contradicting,{exact:false}).first().waitFor()
  await audit(operator,'E.1-second-evidence-recorded')
}
export async function createDecision(operator,origin,audit) {
  await operator.goto(origin+'/app/decisions',{waitUntil:'networkidle'})
  await operator.getByText('Create decision',{exact:true}).first().click()
  const create=form(operator,'New decision')
  await create.getByLabel('Question',{exact:true}).fill(question)
  await create.getByLabel('Owner',{exact:true}).selectOption({label:'Owner'})
  await save(operator,create,'Create decision','/api/operator/decisions')
  await operator.getByRole('link').filter({has:operator.getByRole('heading',{name:question,exact:true})}).click()
  await operator.waitForLoadState('networkidle')
  const slug=new URL(operator.url()).pathname.split('/').at(-1)
  const brief=await operator.request.get(origin+`/api/operator/decisions/${slug}`).then(r=>r.json())
  for(const title of bets){
    const add=form(operator,'Add candidate bet')
    await add.getByLabel('Bet title',{exact:true}).fill(title)
    await add.getByLabel('Approach',{exact:true}).fill(title==='Onboarding progress dashboard'?'Show each onboarding step and blocker.':'Send a weekly summary of onboarding blockers.')
    await save(operator,add,'Add bet',`/api/operator/decisions/${brief.id}/bets`)
    await operator.getByRole('heading',{name:title,exact:true}).waitFor()
  }
  for(const [index,title] of bets.entries()){
    const card=operator.locator('article,section,div').filter({has:operator.getByRole('heading',{name:title,exact:true})}).filter({has:operator.getByText('Manage this bet',{exact:true})}).last()
    await card.getByText('Manage this bet',{exact:true}).click()
    const dimensions=card.getByRole('form',{name:'Edit comparison dimensions',exact:true})
    await dimensions.getByLabel('Urgency',{exact:true}).fill('Customer onboarding is blocked now.')
    await dimensions.getByLabel('Delivery shape',{exact:true}).fill(index===0?'A focused dashboard':'A scheduled digest')
    await dimensions.getByLabel('Observable success measure',{exact:true}).fill('Teams finish onboarding without a support chase.')
    const pending=operator.waitForResponse(r=>new URL(r.url()).pathname.includes('/bets/')&&r.request().method()==='PATCH')
    await dimensions.getByRole('button',{name:'Save',exact:true}).click(); assert.equal((await pending).ok(),true,'[DEC-004] comparison dimensions saved through UI')
    const link=card.getByRole('form',{name:'Link evidence',exact:true})
    const selector=link.locator('select').first()  // the label also contains the option text, so the first control is the evidence choice
    const choice=selector.locator('option').filter({hasText:index===0?supporting:contradicting})
    await choice.first().waitFor({state:'attached'})
    assert.equal(await choice.count(),1,'[EVID-004] real recorded evidence available in bet selector')
    await selector.selectOption(await choice.getAttribute('value'))
    await link.getByLabel('Stance',{exact:true}).selectOption(index===0?'supporting':'contradicting')
    const linked=operator.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/links')&&r.request().method()==='PUT')
    await link.getByRole('button',{name:'Save',exact:true}).click(); assert.equal((await linked).ok(),true,'[DEC-004] evidence stance linked through UI')
    await audit(operator,`E.1-bet-${index+1}-compared`)
  }
  const commit=form(operator,'Commit decision')
  assert.equal(await commit.locator('select[name="ownerOperatorId"] option:checked').innerText(),'Owner','[DEC-004] the commit form shows the decision owner once options load')
  await commit.getByLabel('Selected bet',{exact:true}).selectOption({label:bets[0]})
  await commit.getByLabel('Rationale',{exact:true}).fill('Internal rationale: direct visibility addresses the observed problem.')
  await commit.getByLabel('Confidence',{exact:true}).selectOption('medium')
  await commit.getByLabel('Review date',{exact:true}).fill(new Date().toISOString().slice(0,10))
  await audit(operator,'E.1-decision-ready-to-commit')
  const committed=await save(operator,commit,'Commit selected bet',`/api/operator/decisions/${brief.id}/commit`)
  await operator.getByText('Selected commitment',{exact:true}).waitFor()
  await audit(operator,'E.1-bet-A-committed')
  return {decisionSlug:slug,decisionId:brief.id,...committed}
}
