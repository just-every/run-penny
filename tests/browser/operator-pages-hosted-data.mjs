import assert from 'node:assert/strict'
import {createHash, X509Certificate} from 'node:crypto'
import {mkdtemp, rm, readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {tlsIdentity, workerRuntime} from '../data/tls-runtime.mjs'
import {archiveJournal} from '../../scripts/portability/archive-journal.mjs'
import {finishFirstRun} from './local-signin.mjs'
import {monitorLockReads,inspectLockedWorkspace} from './data-lock-reads.mjs'

/** Trust only this test certificate's public key; Node requests use its explicit CA. */
export async function prepareHostedDataReview() {
  const directory=await mkdtemp(join(tmpdir(),'penny-hosted-screen-'))
  try {
    const identity=await tlsIdentity(directory)
    const publicKey=new X509Certificate(identity.cert).publicKey.export({type:'spki',format:'der'})
    const pin=createHash('sha256').update(publicKey).digest('base64')
    return {directory,identity,trustArgument:`--ignore-certificate-errors-spki-list=${pin}`,close:()=>rm(directory,{recursive:true,force:true})}
  } catch(error) {await rm(directory,{recursive:true,force:true});throw error}
}

async function assertHostedPanel(page,overview,cookie) {
  assert.equal(overview.hosted,true,'[DATA-001 DATA-003] production overview selects the mounted hosted panel')
  await page.getByRole('heading',{name:'Hosted workspace data',exact:true}).waitFor()
  // Hosted restore, erasure and import run in the app with the browser session: no session file or command.
  for(const name of ['Restore a backup','Erase personal data'])await page.getByText(name,{exact:true}).waitFor()
  await page.getByRole('heading',{name:'Move saved feedback in',exact:true}).waitFor()
  assert.doesNotMatch(await page.locator('main').innerText(),/session file|__Host-operator_session|npm run/,'[DATA-003] hosted data needs no copied session or command')
  const exportButton=page.getByRole('button',{name:'Export workspace',exact:true})
  assert.equal(await exportButton.count(),overview.canExport?1:0,'[DATA-001] only a native owner sees workspace export')
  if(overview.canExport)assert.equal(await exportButton.isDisabled(),Boolean(overview.operation),'[DATA-001] maintenance blocks starting another export')
  const text=await page.locator('main').innerText()
  assert.ok(!text.includes(cookie.split('=')[1]),'[BASE-SECRET-002] mounted hosted panel excludes native session material')
  // Progress is described in plain words, never by stored state names or operation IDs.
  assert.doesNotMatch(text,/\b(?:pending_import|running_import|pending_r2|running_r2)\b|operation (?:pending|running)/,'[DATA-003] data state is described in plain words')
  if(overview.operation) {
    await page.getByRole('heading',{name:'Backup in progress',exact:true}).waitFor()
    assert.ok(!text.includes(overview.operation.id),'[DATA-001] the operation is described, not identified by its ID')
  } else assert.equal(await page.getByRole('heading',{name:/in progress|^Erasing|^Restoring/}).count(),0,'[DATA-001] an idle workspace shows no operation in progress')
}

async function bounded(promise,milliseconds,message) {
  let timer
  try {return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),milliseconds)})])}
  finally {clearTimeout(timer)}
}

/** Hold only the real export's R2 list transport after its native reservation. */
function exportReadHold() {
  let entered,release
  const reached=new Promise(resolve=>{entered=resolve}),released=new Promise(resolve=>{release=resolve})
  return {
    release,
    async pause(){entered();await bounded(released,60000,'[DATA-001] export storage hold was not released')},
    async wait(completion){await bounded(Promise.race([reached,completion.then(()=>assert.fail('[DATA-001] export completed before reaching original storage'))]),30000,'[DATA-001] export did not reach original storage')},
  }
}

/** Observe the durable reservation while the real export waits at storage.
 * The API and SSR document both read real state; no responses or rows are replayed. */
async function observeActiveExport(runtime,cookie,hold,completion=runtime.call('/api/operator/data/export',undefined,{Cookie:cookie})) {
  // Attach rejection handling immediately while the concurrent guarded read observes its reservation.
  completion.catch(()=>{})
  try {
    await hold.wait(completion)
    const response=await runtime.call('/api/operator/data/overview',undefined,{Cookie:cookie})
    assert.equal(response.status,200,'[DATA-001] active-operation observation remains natively authorized')
    const overview=JSON.parse(response.text)
    assert.ok(overview.operation,'[DATA-001] real export owns the native reservation')
    assert.equal(overview.operation.kind,'export')
    assert.equal(overview.operation.status,'pending')
    return {overview,completion}
  } catch(error) {hold.release();await completion.catch(()=>{});throw error}
}

export async function reviewHostedData({browser,hosted,width,capture}) {
  const directory=join(hosted.directory,`state-${width}`)
  let runtime,context,exportCompletion,reads
  const hold=exportReadHold()
  const errors=[],external=[]
  try {
    runtime=await workerRuntime(directory,hosted.identity,'production',{assets:true,beforeExportList:hold.pause})
    await runtime.migrate()
    const cookie=await runtime.owner(),split=cookie.indexOf('='),{origin}=runtime
    context=await browser.newContext({viewport:{width,height:width===390?844:900},timezoneId:'Australia/Brisbane'})
    await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin,httpOnly:true,secure:true,sameSite:'Lax'}])
    const page=await context.newPage()
    page.on('pageerror',error=>errors.push(error.message))
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
    page.on('request',request=>{if(new URL(request.url()).origin!==origin)external.push(new URL(request.url()).origin)})
    await page.goto(origin+'/app/data')
    assert.equal(await finishFirstRun(page,async()=>{}),true,'[BASE-ACCESS-002] native owner finishes the real first-run form')
    const idle=await runtime.call('/api/operator/data/overview',undefined,{Cookie:cookie})
    assert.equal(idle.status,200,'[DATA-001] idle observation remains natively authorized')
    const idleOverview=JSON.parse(idle.text)
    assert.equal(idleOverview.operation,null)
    const document=await page.goto(origin+'/app/data')
    assert.equal(document.status(),200)
    assert.equal(new URL(page.url()).pathname,'/app/data')
    assert.doesNotMatch(await document.text(),/Backup in progress|Erasing personal data|Restoring a backup</,'[DATA-001] the real SSR document contains idle state')
    await assertHostedPanel(page,idleOverview,cookie)
    const details={scope:'source-only, local TLS emitted production-mode Worker',authority:'native bootstrap cookie and first-run form',tlsTrust:'test-certificate SPKI pin; explicit CA for Node',api:'/api/operator/data/overview',providerCalls:0}
    await capture('DATA-001-hosted-idle',page,{...details,operation:null})

    // A populated inbox exercises the server snapshot enrichments as well as its list API.
    const recorded=await runtime.call('/api/operator/evidence',{sourceType:'interview',wording:'Finance needs a monthly CSV export.',observedAt:new Date().toISOString()},{Cookie:cookie})
    assert.equal(recorded.status,201)
    const feedback=await context.newPage()
    reads=monitorLockReads(runtime,cookie,'Export workspace')
    const reserved=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/portability/exports'&&response.request().method()==='POST')
    await page.getByRole('button',{name:'Export workspace',exact:true}).click()
    assert.equal((await reserved).status(),201)
    await inspectLockedWorkspace({page:feedback,runtime,reads,capture,label:'DATA-001-feedback-export-locked'})
    const archiveLink=page.getByRole('link',{name:'Download archive',exact:true}),journalLink=page.getByRole('link',{name:'Download erasure journal',exact:true})
    await archiveLink.waitFor({timeout:120000});await journalLink.waitFor()
    const [archiveDownload]=await Promise.all([page.waitForEvent('download'),archiveLink.click()])
    const [journalDownload]=await Promise.all([page.waitForEvent('download'),journalLink.click()])
    const archiveBytes=await readFile(await archiveDownload.path()),journalBytes=await readFile(await journalDownload.path())
    const verified=await archiveJournal(new Blob([archiveBytes]).stream())
    assert.deepEqual(JSON.parse(journalBytes.toString('utf8')),verified.journal,'[DATA-001] browser downloads the journal of this exact verified Base archive')
    assert.equal(verified.manifest.product,'just-every/penny')
    const db=await runtime.db()
    const savedOperation=await db.prepare('SELECT lock_id FROM data_state').first('lock_id')
    assert.ok(savedOperation,'[DATA-001] verified downloads remain recoverable until explicit finish')
    await page.reload()
    await page.getByRole('heading',{name:'Export ready to download',exact:true}).waitFor()
    assert.equal(await db.prepare('SELECT lock_id FROM data_state').first('lock_id'),savedOperation,'[DATA-001] reload retains the same export')
    await page.getByRole('button',{name:'Resume export',exact:true}).click()
    await archiveLink.waitFor({timeout:120000})
    const [resumedDownload]=await Promise.all([page.waitForEvent('download'),archiveLink.click()])
    assert.deepEqual(await readFile(await resumedDownload.path()),archiveBytes,'[DATA-001] reload resumes the exact verified archive')
    await page.getByRole('button',{name:'Finish export',exact:true}).click()
    await page.getByRole('button',{name:'Export workspace',exact:true}).waitFor()
    assert.equal(await db.prepare('SELECT lock_id FROM data_state').first('lock_id'),null,'[DATA-001] browser export releases source maintenance')
    assert.equal((await db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'rer_portability_snap_%'").all()).results.length,0,'[DATA-001] browser export removes source snapshots')
    await reads.stop();reads=null
    await capture('DATA-001-hosted-downloads',page,{...details,format:verified.manifest.format,pairedJournal:true,sourceCleanup:true})

    reads=monitorLockReads(runtime,cookie,'Download backup')
    const backup=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/operator/data/export').then(async response=>({status:response.status(),text:await response.text()}))
    const backupDownload=page.waitForEvent('download')
    await page.getByRole('button',{name:'Download backup',exact:true}).click()
    const active=await observeActiveExport(runtime,cookie,hold,backup)
    exportCompletion=active.completion
    try {
      await inspectLockedWorkspace({page:feedback,runtime,reads,capture,label:'DATA-001-feedback-backup-locked'})
      const activePage=await context.newPage()
      const response=await activePage.goto(origin+'/app/data')
      assert.equal(response.status(),200)
      assert.equal(new URL(activePage.url()).pathname,'/app/data')
      const document=await response.text()
      assert.match(document,/Backup in progress/,'[DATA-001] real SSR renders the reserved export in plain words')
      await assertHostedPanel(activePage,active.overview,cookie)
      await capture('DATA-001-hosted-active-operation',activePage,{...details,operation:active.overview.operation,observation:'Real SSR and hydrated panel read the native pending export reservation while its original R2 list transport is held.'})
      const held=await runtime.call('/api/operator/data/overview',undefined,{Cookie:cookie})
      assert.equal(held.status,200)
      assert.deepEqual(JSON.parse(held.text).operation,active.overview.operation,'[DATA-001] the real reservation remains pending throughout capture')
    } finally {hold.release()}
    const completed=await exportCompletion
    await backupDownload
    assert.equal(completed.status,200,'[DATA-001] actual guarded export completes')
    const status=await runtime.call('/api/operator/data/operations/'+active.overview.operation.id,undefined,{Cookie:cookie})
    assert.equal(status.status,200)
    assert.equal(JSON.parse(status.text).status,'complete','[DATA-001] captured operation has a real complete receipt')
    const after=await runtime.call('/api/operator/data/overview',undefined,{Cookie:cookie})
    assert.equal(after.status,200)
    assert.equal(JSON.parse(after.text).operation,null,'[DATA-001] actual export releases its native lock')
    await reads.stop();reads=null
    assert.deepEqual(errors,[],'[BASE-UX-001] hosted captures have no unexpected console or page errors')
    assert.deepEqual(external,[],'[BASE-SECRET-002] hosted captures make no external browser requests')
    assert.equal(runtime.outboundCalls,0,'[DATA-001] hosted screen capture makes no provider request')
  } finally {
    hold.release()
    try {await exportCompletion;await reads?.stop()} finally {try{await context?.close()}finally{try{await runtime?.stop()}finally{await rm(directory,{recursive:true,force:true})}}}
  }
}
