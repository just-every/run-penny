import { readDevKey } from '../../base/modules/operator-auth/dev/sign-in-as.mjs'

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
export async function signIn(page, runtime, audit, { finishSetup = true } = {}) {
  const key = await readDevKey(runtime.root)
  await page.goto(`${runtime.origin}/__dev/key#rer-dev=${key}&as=owner`, { waitUntil: 'networkidle' })
  await page.waitForURL(url => ['/setup','/app','/app/','/app/overview'].includes(url.pathname))
  if (!finishSetup) return
  await finishFirstRun(page, audit)
  await audit(page, 'G.6-signed-in', { axeZero: true })
}
