import assert from 'node:assert/strict'
import { readDevKey } from '../../base/modules/operator-auth/dev/sign-in-as.mjs'

// The outbox answers only behind the checkout's key gate: this is the link
// `rer outbox` prints as RER_OPEN, trading the key (in the fragment) for the gate cookie.
export const gatedOutboxUrl = async (root, origin) => `${origin}/__dev/key#rer-dev=${await readDevKey(root)}&next=%2F__dev%2Foutbox`
export async function openOutboxLink(page, runtime, audit, label, outboxUrl) {
  await page.goto(outboxUrl ?? await gatedOutboxUrl(runtime.root, runtime.origin), { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Development outbox', exact: true }).waitFor()
  await audit(page, `${label}-outbox`, { axeZero: true, redact: true })
  await page.getByRole('link', { name: 'Read message', exact: true }).first().click()
  await page.getByRole('link', { name: 'Open this link', exact: true }).waitFor()
  await audit(page, `${label}-message`, { axeZero: true, redact: true })
  const detailPath = new URL(page.url()).pathname + new URL(page.url()).search
  await page.getByRole('link', { name: 'Open this link', exact: true }).click()
  await page.waitForLoadState('networkidle')
  return detailPath
}
// A signed-in owner whose first-run setup is unfinished is sent to /setup; finish it there and arrive in the app.
export async function finishFirstRun(page, audit) {
  if (new URL(page.url()).pathname !== '/setup') return false
  await page.getByRole('heading', { name: 'Finish setup', exact: true }).waitFor()
  await audit(page, 'first-run-setup', { axeZero: true })
  await page.getByLabel('I confirm this owner account is ready to use.').check()
  await page.getByRole('button', { name: 'Finish setup', exact: true }).click()
  await page.waitForURL(url => ['/app', '/app/', '/app/overview'].includes(url.pathname))
  await page.waitForLoadState('networkidle')
  return true
}
export async function signIn(page, runtime, audit, { outboxUrl, finishSetup } = {}) {
  await page.goto(runtime.origin + '/signin', { waitUntil: 'networkidle' })
  await audit(page, 'G.6-signin', { axeZero: true })
  await page.getByLabel('Operator email', { exact: true }).fill('owner@penny.invalid')
  const requested = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/magic-link' && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Send sign-in link', exact: true }).click()
  try { assert.equal((await requested).status(), 202, '[BASE-ACCESS-002] native operator link request accepted') }
  catch(error) {
    const state=await page.evaluate(()=>({path:location.pathname,formValid:document.querySelector('form')?.checkValidity(),emailPresent:document.querySelector('input[name=email]')?.value==='owner@penny.invalid',alert:document.querySelector('[role=alert]')?.textContent??null,submitDisabled:document.querySelector('button[type=submit],form button')?.disabled}))
    console.log('Sign-in failure state: '+JSON.stringify(state))
    throw error
  }
  await page.getByText('If your address is allowed, check your email for a sign-in link.', { exact: true }).waitFor()
  await audit(page, 'G.6-link-requested', { axeZero: true })
  return signInFromOutbox(page, runtime, audit, { outboxUrl, finishSetup })
}
// `finishSetup: false` stops at the page the sign-in link returns to, so the caller can inspect first-run routing.
export async function signInFromOutbox(page, runtime, audit, { outboxUrl, finishSetup = true } = {}) {
  await openOutboxLink(page, runtime, audit, 'G.6-operator', outboxUrl)
  const confirmationUrl=page.url()
  await page.getByRole('heading', { name: 'Confirm sign-in to Penny', exact: true }).waitFor()
  assert.equal((await page.context().request.get(runtime.origin + '/api/auth/session')).status(), 401, '[BASE-ACCESS-002] GET confirmation creates no operator session')
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Confirm sign-in to Penny', exact: true }).waitFor()
  await audit(page, 'H.2-confirm-signin', { axeZero: true, redact: true })
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await page.waitForURL(url => ['/setup', '/app', '/app/', '/app/overview'].includes(url.pathname))
  await page.waitForLoadState('networkidle')
  if (!finishSetup) return confirmationUrl
  await finishFirstRun(page, audit)
  await page.getByRole('heading', { name: 'Make the next roadmap call defensible.', exact: true }).waitFor()
  await audit(page, 'G.6-empty-overview', { axeZero: true })
  assert.equal(await page.getByText(/sample|SCIM|Northstar/).count(), 0, '[G.2] No samples on first Overview')
  return confirmationUrl
}
export async function verifyRequester(page, runtime, audit) {
  await page.goto(runtime.origin + '/portal/feedback/new', { waitUntil: 'networkidle' })
  await audit(page, 'G.6-requester-verification-form', { axeZero: true })
  await page.getByLabel('Display name', { exact: true }).fill('Local requester')
  await page.getByLabel('Email', { exact: true }).fill('requester@penny.invalid')
  await page.getByRole('button', { name: 'Send verification link', exact: true }).click()
  await page.getByText('Check your email for a verification link; it expires after 30 minutes.', { exact: true }).waitFor()
  await audit(page, 'G.6-requester-link-requested', { axeZero: true })
  await openOutboxLink(page, runtime, audit, 'G.6-requester')
  await page.getByRole('heading', { name: 'Verify your email', exact: true }).waitFor()
  await audit(page, 'G.6-requester-confirm', { axeZero: true, redact: true })
  const verification = page.waitForResponse(response => new URL(response.url()).pathname === '/api/public/identity/email/verify')
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  const response = await verification
  assert.equal(response.status(), 200, `[REQ-023] requester verification returned ${response.status()}`)
  await page.getByText('Email verified.', { exact: true }).waitFor()
  assert.ok(await page.evaluate(() => localStorage.getItem('penny_requester_session')), '[REQ-023] real local requester session')
  await audit(page, 'G.6-requester-verified', { axeZero: true })
}
