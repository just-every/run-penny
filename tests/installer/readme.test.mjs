import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import { chromium } from '@playwright/test'
import { browserOptions } from '../browser/browser-options.mjs'
import { createAudit, evidenceDirectory, viewports } from '../browser/acceptance-audit.mjs'
import { freshLocalRuntime } from '../browser/fresh-local-runtime.mjs'
import { signIn, finishFirstRun } from '../browser/local-signin.mjs'
import { readmeCommands } from './readme-commands.mjs'
import { openOperatorRoute } from '../browser/operator-navigation.mjs'
import { createRedaction as diagnosticRedaction } from '@runeditrun/rer/redaction'
const redact=(text,secrets=[])=>{const filter=diagnosticRedaction();filter.addSecrets(secrets);return filter.redact(String(text)).replaceAll('[REDACTED]','[redacted]')}

test('[BASE-OPS-002 BASE-ACCESS-002] README install/setup/dev and one-click sign-in a fresh frozen clone, send the owner through first-run setup into the app at both widths', {timeout:900000}, async () => {
  const readme = await readFile(new URL('../../README.md', import.meta.url), 'utf8')
  readmeCommands(readme, 'owner@penny.invalid')
  process.env.TMPDIR = resolve(process.env.PENNY_WORK_ROOT ?? '..', 'tmp')
  await mkdir(process.env.TMPDIR, {recursive:true})
  // The executable comes from the pinned Playwright installation unless the
  // runner supplies its explicit installed executable. No alternate browser.
  process.env.PENNY_BROWSER_EXECUTABLE ??= chromium.executablePath()
  const output = evidenceDirectory('installer-readme'), browser = await chromium.launch(browserOptions())
  const diagnostics=[]
  try {
    for (const viewport of viewports) {
      // Each width starts from its own fresh clone, so first-run setup is unfinished when the owner signs in.
      const runtime = await freshLocalRuntime(viewport, output)
      try {
        const context = await browser.newContext({viewport})
        try {
          const {audit,finish} = await createAudit(context, runtime.origin, output, viewport)
          const page = await context.newPage()
          page.on('pageerror',error=>diagnostics.push({kind:'pageerror',message:redact(error.message)}))
          page.on('console',message=>{if(message.type()==='error')diagnostics.push({kind:'console',message:redact(message.text())})})
          page.on('requestfailed',request=>diagnostics.push({kind:'requestfailed',path:new URL(request.url()).pathname,error:request.failure()?.errorText}))
          const claimBefore = await context.request.get(runtime.origin + '/setup/state')
          assert.equal(claimBefore.status(), 200)
          assert.deepEqual(await claimBefore.json(), {state:'unclaimed'})
          assert.ok(claimBefore.headers()['cache-control'].includes('no-store'))
          assert.equal(claimBefore.headers()['set-cookie'], undefined)
          // Signed out, setup sends the visitor to sign-in with the way back.
          const anonymous = await context.request.get(runtime.origin + '/setup', {maxRedirects:0})
          assert.equal(anonymous.status(), 303)
          assert.equal(new URL(anonymous.headers().location, runtime.origin).pathname + new URL(anonymous.headers().location, runtime.origin).search, '/signin?returnTo=%2Fsetup')
          await signIn(page, runtime, audit, { finishSetup: false })
          // The owner's setup is unfinished: the sign-in link, and every app document, lead to /setup.
          assert.equal(new URL(page.url()).pathname, '/setup', '[FIRST-RUN] sign-in returns the owner to setup')
          const session = await context.request.get(runtime.origin + '/auth/session')
          assert.equal(session.status(), 200, '[BASE-ACCESS-002] confirmation admits the native owner')
          const authority = await session.json()
          assert.equal(authority.operator.email, 'owner@penny.invalid', '[BASE-ACCESS-002] saved owner is the current operator')
          assert.equal(authority.operator.role, 'owner', '[BASE-ACCESS-002] current authority retains owner role')
          const redirected = await context.request.get(runtime.origin + '/app/feedback', {maxRedirects:0})
          assert.equal(redirected.status(), 303)
          assert.equal(new URL(redirected.headers().location, runtime.origin).pathname, '/setup', '[FIRST-RUN] an app document sends an unfinished owner to setup')
          assert.equal(await finishFirstRun(page, audit), true)
          assert.equal(new URL(page.url()).pathname, '/app', '[FIRST-RUN] finishing setup opens the app')
          const claimAfter = await context.request.get(runtime.origin + '/setup/state')
          assert.deepEqual(await claimAfter.json(), {state:'claimed'})
          const board = await context.request.get(runtime.origin + '/?sort=votes')
          assert.equal(board.status(), 200)
          assert.ok((await board.text()).includes('id="feedback-heading"'))
          const finished = await context.request.get(runtime.origin + '/setup', {maxRedirects:0})
          assert.equal(finished.status(), 303)
          assert.equal(new URL(finished.headers().location, runtime.origin).pathname, '/app', '[FIRST-RUN] later visits to setup go to the app')
          assert.equal((await context.request.get(runtime.origin + '/')).status(), 200)
          assert.equal((await context.request.get(runtime.origin + '/__dev/outbox')).status(), 404)
          for (const path of ['/missing-installer-document','/missing-installer-asset.js']) assert.equal((await context.request.get(runtime.origin + path)).status(), 404)
          assert.equal((await context.request.get(runtime.origin + '/', {headers:{Host:'foreign.penny.invalid'}})).status(), 421)
          let documents = 0
          page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++ })
          await openOperatorRoute(page, '/app/feedback')
          assert.equal(documents, 0, '[BASE-ACCESS-002] hydrated navigation uses no new document')
          await page.getByRole('form', {name:'New evidence',exact:true}).waitFor({state:'visible'})
          await audit(page, 'installer-readme-evidence')
          await finish('installer-readme', {commands:runtime.commands.slice(0,3), scope:'Fresh clone, README install/setup/dev, repeated setup and one-click sign-in through first-run setup into the app', width:viewport.width})
        } finally { await context.close() }
      } catch(error) {await runtime.saveDiagnostics?.();await writeFile(resolve(output,'browser-failure.json'),JSON.stringify(diagnostics,null,2)+'\n',{mode:0o600});throw error}
      finally { await runtime.close() }
    }
  } finally { await browser.close() }
})
