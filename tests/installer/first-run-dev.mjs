import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {parseEnv} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {chromium} from '@playwright/test'
import {browserOptions} from '../browser/browser-options.mjs'
import {finishFirstRun} from '../browser/local-signin.mjs'
import {localDatabaseFile} from '../browser/local-database.mjs'

/** Follow the actual local command's owner entry, then exercise silent identity mail. */
export async function proveLocalFirstRun(runtime,output) {
  const {root,origin} = runtime
  // The app health route can answer before the command publishes its owner entry.
  const deadline = Date.now()+60_000
  let entry
  while (!entry) {
    try {entry = (await readFile(join(root,'.rer/local/open-url'),'utf8')).trim()}
    catch (error) {if (error.code !== 'ENOENT') throw error}
    if (!entry) {
      assert.ok(Date.now()<deadline,'rer dev publishes its owner entry after becoming healthy')
      await delay(100)
    }
  }
  assert.equal(new URL(entry).origin,origin)
  const browser = await chromium.launch(browserOptions())
  const context = await browser.newContext({viewport:{width:1440,height:900}})
  try {
    const page = await context.newPage()
    await page.goto(entry,{waitUntil:'networkidle'})
    await page.waitForURL(url => url.pathname === '/setup')
    const session = await context.request.get(origin+'/auth/session')
    assert.equal(session.status(),200)
    const authority = await session.json()
    const ownerEmail = parseEnv(await readFile(join(root,'.dev.vars'),'utf8')).OPERATOR_EMAIL
    assert.equal(authority.operator.email,ownerEmail)
    assert.equal(authority.operator.role,'owner')
    assert.equal(authority.kind,'dev')
    for (const path of ['/app','/app/overview','/app/settings']) {
      const blocked = await context.request.get(origin+path,{maxRedirects:0})
      assert.equal(blocked.status(),303)
      assert.equal(new URL(blocked.headers().location,origin).pathname,'/setup')
    }
    await mkdir(output,{recursive:true})
    async function capture(name) {
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({path:resolve(output,`${name}-1440.png`),fullPage:true})
      await page.setViewportSize({width:390,height:844})
      await page.screenshot({path:resolve(output,`${name}-390.png`),fullPage:true})
      await page.setViewportSize({width:1440,height:900})
    }
    await capture('local-first-run-setup')
    const email = ['synthetic-penny-silent-reader','example.test'].join('@')
    for (const [path,data,accepted] of [
      ['/api/auth/magic-link',{email:ownerEmail},{status:'accepted'}],
      ['/api/public/identity/email',{email,displayName:'Synthetic reader'},{accepted:true}],
    ]) {
      const response = await context.request.post(origin+path,{headers:{Origin:origin},data})
      assert.equal(response.status(),202)
      assert.deepEqual(await response.json(),accepted)
    }
    for (const path of ['/__dev/outbox','/__dev/outbox?message=anything']) {
      assert.equal((await context.request.get(origin+path)).status(),404)
    }
    const db = new DatabaseSync(await localDatabaseFile(join(root,'.wrangler/state')),{readOnly:true})
    try {
      assert.equal(db.prepare('SELECT COUNT(*) n FROM local_auth_outbox').get().n,0)
      if (db.prepare("SELECT name FROM sqlite_master WHERE name='rer_mail_development_outbox'").get()) {
        assert.equal(db.prepare('SELECT COUNT(*) n FROM rer_mail_development_outbox').get().n,0)
      }
      const attempts = db.prepare('SELECT feature,outcome,phase,transport FROM penny_auth_mail_attempts ORDER BY feature').all().map(row => ({...row}))
      assert.deepEqual(attempts,[
        {feature:'operator_magic_link',outcome:'development',phase:'finished',transport:'development'},
        {feature:'requester_verification',outcome:'development',phase:'finished',transport:'development'},
      ])
    } finally {db.close()}
    assert.equal(await finishFirstRun(page,async () => {}),true)
    const app = await context.request.get(origin+'/app/overview',{maxRedirects:0})
    assert.equal(app.status(),200)
    const later = await context.request.get(origin+'/setup',{maxRedirects:0})
    assert.equal(later.status(),303)
    assert.equal(new URL(later.headers().location,origin).pathname,'/app')
    await capture('local-first-run-app')
  } finally {await context.close(); await browser.close()}
}
