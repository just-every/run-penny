import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import { chromium } from '@playwright/test'
import { startBrowserRuntime } from './base-runtime.mjs'
import { browserOptions } from './browser-options.mjs'
import { viewports } from './acceptance-audit.mjs'

process.env.PENNY_BROWSER_EXECUTABLE ??= chromium.executablePath()

test('the declared owner sign-in opens with an editable email and reaches the workspace', { timeout: 240_000 }, async () => {
  const spec = JSON.parse(await readFile('management/integration/deployment-spec.json', 'utf8'))
  const email = 'aisha@harbourphysio.example'
  const runtime = await startBrowserRuntime({ bindings: { OPERATOR_EMAIL: email } })
  const output = resolve(process.env.PENNY_SIGNIN_SHOTS ?? '../shots')
  await mkdir(output, { recursive: true })
  let browser
  try {
    const claimed = await fetch(runtime.origin + '/auth/bootstrap', {
      method: 'POST', redirect: 'manual',
      headers: { Origin: runtime.origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'synthetic-base-browser-setup-token-12345', displayName: 'Aisha Patel', returnTo: '/setup' }),
    })
    assert.equal(claimed.status, 303)
    browser = await chromium.launch(browserOptions())
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport })
      try {
        const page = await context.newPage(), errors = []
        page.on('pageerror', error => errors.push(error.message))
        const capture = async name => {
          await page.evaluate(() => document.fonts.ready)
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
          await page.screenshot({ path: resolve(output, `${name}-${viewport.width}.png`), fullPage: true })
        }
        const target = new URL(spec.surfaces.app.signIn.path, runtime.origin)
        if (spec.surfaces.app.signIn.loginHint) target.searchParams.set('login_hint', email)
        const before = runtime.outbox.length
        await page.goto(target.href, { waitUntil: 'networkidle' })
        const input = page.getByRole('textbox', { name: 'Operator email', exact: true })
        assert.equal(await input.inputValue(), email)
        assert.equal(runtime.outbox.length, before, 'opening sign-in sends no email')
        await input.fill('jules@harbourphysio.example')
        assert.equal(await input.inputValue(), 'jules@harbourphysio.example')
        await input.fill(email)
        await capture('signin-prefilled')
        await page.getByRole('button', { name: 'Send sign-in link', exact: true }).click()
        await page.getByRole('status').filter({ hasText: 'check your email' }).waitFor()
        await capture('signin-requested')
        const message = runtime.outbox.at(-1)
        assert.equal(message.email, email)
        await page.goto(message.url)
        await page.getByRole('button', { name: 'Confirm', exact: true }).click()
        await page.waitForURL(url => url.pathname === '/setup' || url.pathname.startsWith('/app'))
        if (new URL(page.url()).pathname === '/setup') {
          await page.getByLabel('Company name', {exact:true}).fill('Example Company')
          await page.getByLabel('Business postal address', {exact:true}).fill('14 Example Street, Brisbane QLD 4000, Australia')
          await page.getByRole('checkbox').check()
          await page.getByRole('button', { name: 'Finish setup', exact: true }).click()
        }
        await page.waitForURL(url => url.pathname.startsWith('/app'))
        await page.waitForLoadState('networkidle')
        await capture('owner-workspace')
        assert.deepEqual(errors, [])
        await context.clearCookies()
        for (const query of ['', '?login_hint=incomplete']) {
          await page.goto(runtime.origin + spec.surfaces.app.signIn.path + query, { waitUntil: 'networkidle' })
          assert.equal(await input.inputValue(), '', 'absent and incomplete hints leave email empty')
        }
      } finally { await context.close() }
    }
  } finally { await browser?.close(); await runtime.close() }
})
