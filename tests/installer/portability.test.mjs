import { fileURLToPath as __rerTestEntryPath } from 'node:url';
const __rerTestEntry = __rerTestEntryPath(import.meta.resolve('@runeditrun/rer/internal/global/rer.mjs'));
const __rerTestEntryArgs = args => args[1] === 'dev' && !args.some(arg => ['--foreground', '--detach', '--stop', '--help'].includes(arg)) ? [...args, '--foreground'] : args;
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, cp, symlink, readFile, writeFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getPlatformProxy } from 'wrangler'
import { currentClauseGraph } from '../data/current-clause-graph.mjs'
import { originalBytes } from '../data/prior-clause-graph.mjs'
const execute = promisify(execFile)
const archiveRows = archive => archive.filter(item => item.kind === 'part').flatMap(part => part.items).filter(item => item.kind === 'row')
const tableCounts = archive => archiveRows(archive).reduce((counts,item) => ({...counts,[item.table]:(counts[item.table]??0)+1}),{})

test('[DATA-001 DATA-003] local CLI restores original files and held effects into a fresh installation, refuses occupied restore, and survives contained reset', { timeout: 600000 }, async t => {
  const area = await mkdtemp(join(tmpdir(), 'penny-cli-data-')), root = join(area, 'installation')
  t.after(() => rm(area, { recursive: true, force: true }))
  const source = resolve(new URL('../../', import.meta.url).pathname)
  const installation = async destination => {
    await mkdir(destination)
    for (const path of ['scripts','base','src','migrations','wrangler.jsonc','package.json','OPERATIONS.json','OPERATIONS.md','ACCEPTANCE.md','rer-setup.json','tsconfig.json','tsconfig.app.json','.node-version']) await cp(join(source,path),join(destination,path),{recursive:true})
    await symlink(join(source,'node_modules'),join(destination,'node_modules'),'dir')
  }
  await installation(root)
  const env = { ...process.env, RER_JOBS_DIR: join(area,'jobs'), RER_SERVERS_DIR: join(area,'servers'), WRANGLER_SEND_METRICS:'false' }
  for (const name of Object.keys(env)) if (/^(AUTH_|MAIL_|OIDC_|SENDGRID_|RESEND_|SETUP_TOKEN|OPERATOR_EMAIL|APP_ORIGIN|PENNY_)/.test(name)) delete env[name]
  delete env.RER_LOCAL_OPERATION // This disposable installation owns its own operation.
  const run = async (args, cwd = root) => {
    try { return await execute(process.execPath,args,{cwd,env,maxBuffer:4*1024*1024}) }
    catch(error) { throw new Error(`CLI failed (${error.code}): ${error.stderr?.slice(-3000) ?? ''}`,{cause:error}) }
  }
  // The public export applies the local migrations, so an empty store exists before rows are written.
  await mkdir(join(root,'exports'))
  await run(__rerTestEntryArgs([__rerTestEntry,'export','--output','exports/empty.rer']))
  const open = (destination = root) => getPlatformProxy({configPath:join(destination,'wrangler.jsonc'),persist:{path:join(destination,'.wrangler/state/v3')},remoteBindings:false})
  const proxy = await open()
  try {
    const {DB:db,FILES:files}=proxy.env
    await db.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,created_at) VALUES('source-owner','source-owner@penny.invalid','Source owner','owner','active',1)").run()
    await db.prepare("INSERT INTO operators(id,email,display_name,created_at,updated_at) VALUES('source-owner','source-owner@penny.invalid','Source owner','2026-10-10','2026-10-10')").run()
    await currentClauseGraph(db,files,'source-owner')
    await db.prepare("INSERT INTO oa_bootstrap(singleton,claim_id,claimed_at) VALUES(1,'source-claim',1)").run()
    await db.prepare("INSERT INTO boards(id,name,slug,visibility,position,created_at,updated_at) VALUES('b','Private retained board','board','internal',0,'2026-10-10','2026-10-10')").run()
    await db.prepare("INSERT INTO requests(id,slug,board_id,title,description,moderation_state,public_state,created_at,updated_at) VALUES('r','retained-request','b','Retained','Original wording','awaiting_review','unpublished','2026-10-10','2026-10-10')").run()
    await db.prepare("INSERT INTO attachments(id,request_id,storage_key,original_filename,content_type,byte_size,public_state,created_at,updated_at) VALUES('a','r','original','original.txt','text/plain',14,'operator_only','2026-10-10','2026-10-10')").run()
    await files.put('original','original bytes',{httpMetadata:{contentType:'text/plain'}})
    await db.prepare("INSERT INTO penny_integration_events(id,event,request_id,created_at,held) VALUES('event','request.created','r',1,0)").run()
  } finally {await proxy.dispose()}
  await writeFile(join(root,'.dev.vars'),'OPERATOR_EMAIL=source-owner@penny.invalid\nWORKSPACE_TIMEZONE=UTC\n',{mode:0o600})
  await mkdir(join(root,'.rer/deploy'),{recursive:true})
  await writeFile(join(root,'.rer/deploy/retained'),'deployment receipt')
  await run(__rerTestEntryArgs([__rerTestEntry,'export','--output','exports/first.rer']))
  const first=(await readFile(join(root,'exports/first.rer'),'utf8')).trim().split('\n').map(JSON.parse)
  assert.equal(first[0].objects.length,2)
  const records=archiveRows(first)
  const expectedCounts={evidence_versions:2,attachments:2,decision_revisions:2,decision_evidence_snapshots:2,decision_bet_snapshots:3,release_versions:2,release_outcomes:2,decision_reviews:1,decision_review_notifications:1,requester_update_permissions:2}
  for(const [table,count] of Object.entries(expectedCounts))assert.equal(records.filter(item=>item.table===table).length,count,`${table} is included with complete history`)
  const notification=records.find(item=>item.table==='decision_review_notifications').row
  assert.equal(notification.state,'held','pending owner review mail is held in the archive')
  assert.equal(notification.failure_reason,'restored_delivery_review_required')
  const releaseCommand=records.find(item=>item.table==='notification_outbox'&&item.row.id==='current-delivery').row
  assert.equal(releaseCommand.delivery_state,'unknown','pending correction delivery is held for reconciliation')
  assert.equal(releaseCommand.failure_reason,'restored_delivery_review_required')
  const row=first.filter(x=>x.kind==='part').flatMap(x=>x.items).find(x=>x.kind==='row'&&x.table==='penny_integration_events')
  assert.equal(row.row.held,1,'restoration holds the real pending event')
  const journal = JSON.parse(await readFile(join(root,'exports/first.rer.erasure-journal.json'),'utf8'))
  const assertRestored = async (destination, authority = null) => {
    const restored = await open(destination)
    try {
      const {DB:db,FILES:files} = restored.env
      assert.deepEqual(await db.prepare("SELECT r.title,r.description,r.moderation_state,r.public_state,b.visibility FROM requests r JOIN boards b ON b.id=r.board_id WHERE r.id='r'").first(),{title:'Retained',description:'Original wording',moderation_state:'awaiting_review',public_state:'unpublished',visibility:'internal'},'private domain data and its board relationship survive restoration')
      assert.equal((await db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND (name GLOB 'rer_portability_stage_*' OR name GLOB 'rer_portability_snap_*')").first()).n,0,'completed restore retains no hidden row copies')
      assert.equal((await db.prepare('SELECT COUNT(*) n FROM rer_portability_segments').first()).n,0,'completed restore retains no private archive segments')
      assert.equal(await db.prepare("SELECT COUNT(*) n FROM oa_operators WHERE id='source-owner'").first('n'),0,'source authority is excluded')
      if(authority)for(const [table,rows] of Object.entries(authority))assert.deepEqual((await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results,rows,'destination native authority is retained exactly')
      else{
        assert.equal(await db.prepare('SELECT COUNT(*) n FROM oa_operators').first('n'),0,'reset destination must claim its own owner')
        assert.equal(await db.prepare('SELECT COUNT(*) n FROM oa_bootstrap').first('n'),0)
      }
      assert.equal((await db.prepare("SELECT held FROM penny_integration_events WHERE id='event'").first()).held,1)
      assert.equal(await (await files.get('original')).text(),'original bytes')
      assert.deepEqual(new Uint8Array(await (await files.get('prior-original')).arrayBuffer()),originalBytes)
      assert.equal(await db.prepare("SELECT state FROM decision_review_notifications WHERE id='current-review-notification'").first('state'),'held')
      assert.equal(await db.prepare("SELECT delivery_state FROM notification_outbox WHERE id='current-delivery'").first('delivery_state'),'unknown')
      assert.ok(await db.prepare("SELECT revoked_at FROM native_requester_sessions WHERE id='prior-requester-session'").first('revoked_at'),'restored requester capability is revoked')
      assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[])
      assert.deepEqual(await db.prepare('SELECT origin,epoch FROM data_state WHERE singleton=1').first(),{origin:journal.origin,epoch:journal.epoch},'native journal identity survives restoration')
      assert.deepEqual((await db.prepare('SELECT epoch,table_name,key_hash FROM data_tombstones ORDER BY table_name,key_hash').all()).results,journal.tombstones,'native erasure fences survive restoration')
    } finally { await restored.dispose() }
  }
  const fresh = join(area,'fresh-installation')
  await installation(fresh)
  await assert.rejects(stat(join(fresh,'.wrangler/state')),{code:'ENOENT'},'fresh destination has no existing database')
  await assert.rejects(stat(join(fresh,'.dev.vars')),{code:'ENOENT'},'source settings were not copied')
  await mkdir(join(fresh,'exports'),{mode:0o700})
  for (const filename of ['first.rer','first.rer.erasure-journal.json']) await cp(join(root,'exports',filename),join(fresh,'exports',filename))
  // Prepare independent destination authority through a test fixture; importing must preserve it.
  await run(__rerTestEntryArgs([__rerTestEntry,'export','--output','exports/destination-empty.rer']),fresh)
  const destination=await open(fresh),authority={}
  try{
    const db=destination.env.DB
    await db.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,created_at) VALUES('destination-owner','destination@example.test','Destination owner','owner','active',2)").run()
    await db.prepare("INSERT INTO oa_bootstrap(singleton,claim_id,claimed_at) VALUES(1,'destination-claim',2)").run()
    await db.prepare("INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES('destination-session','destination-token-hash','destination-owner',1,'native',2,9999999999999)").run()
    for(const table of ['oa_operators','oa_bootstrap','oa_sessions'])authority[table]=(await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results
  }finally{await destination.dispose()}
  await run(__rerTestEntryArgs([__rerTestEntry,'import','--input','exports/first.rer','--yes']),fresh)
  await assertRestored(fresh,authority)
  await assert.rejects(stat(join(fresh,'.dev.vars')),{code:'ENOENT'},'restore does not manufacture installation settings')
  await run(__rerTestEntryArgs([__rerTestEntry,'export','--output','exports/roundtrip.rer']),fresh)
  const freshArchive=(await readFile(join(fresh,'exports/roundtrip.rer'),'utf8')).trim().split('\n').map(JSON.parse)
  assert.deepEqual(tableCounts(freshArchive),tableCounts(first))
  assert.equal(first.at(-1).contentHash,freshArchive.at(-1).contentHash,'equivalent domain rows and original bytes survive export to a distinct fresh installation')
  assert.deepEqual(JSON.parse(await readFile(join(fresh,'exports/roundtrip.rer.erasure-journal.json'),'utf8')),journal,'the fresh installation exports the source erasure journal')
  await assert.rejects(run(__rerTestEntryArgs([__rerTestEntry,'import','--input','exports/first.rer','--yes'])))
  await assert.rejects(run(__rerTestEntryArgs([__rerTestEntry,'reset','--non-interactive'])))
  await run(__rerTestEntryArgs([__rerTestEntry,'reset','--yes']))
  assert.equal(await readFile(join(root,'.rer/deploy/retained'),'utf8'),'deployment receipt')
  await run(__rerTestEntryArgs([__rerTestEntry,'import','--input','exports/first.rer','--yes']))
  await assertRestored(root)
  await run(__rerTestEntryArgs([__rerTestEntry,'export','--output','exports/second.rer']))
  const second=(await readFile(join(root,'exports/second.rer'),'utf8')).trim().split('\n').map(JSON.parse)
  assert.deepEqual(tableCounts(second),tableCounts(first))
  assert.equal(first.at(-1).contentHash,second.at(-1).contentHash,'equivalent domain rows and original bytes survive the public command round trip')
  console.log(JSON.stringify({scope:'literal rer export/reset/import/export',populatedClauseTables:expectedCounts,originalFiles:2,completeTableCountsEqual:true,contentHashEqual:true,restoredReviewMail:'held',restoredCorrectionDelivery:'unknown',sourceAuthorityExcluded:true,destinationAuthorityPreserved:true,erasureJournalEqual:true}))
  await writeFile(join(root,'erase-restored.ts'), `import {getPlatformProxy} from 'wrangler';
import {planErasure,eraseEntity} from './src/core/features/data/archive';
const proxy=await getPlatformProxy({configPath:'wrangler.jsonc',persist:{path:'.wrangler/state/v3'},remoteBindings:false});
try {const db=proxy.env.DB as D1Database,bucket=proxy.env.FILES as R2Bucket;
const plan=await planErasure(db,'requests','r');await eraseEntity(db,bucket,'requests','r',plan.planHash);
if(await db.prepare("SELECT 1 FROM requests WHERE id='r'").first() || await bucket.get('original')) throw Error('erasure failed');
if((await db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND (name GLOB 'rer_portability_stage_*' OR name GLOB 'rer_portability_snap_*')").first<{n:number}>())!.n || (await db.prepare('SELECT COUNT(*) n FROM rer_portability_segments').first<{n:number}>())!.n) throw Error('hidden erasure copies');
} finally {await proxy.dispose()}`)
  await run(['node_modules/tsx/dist/cli.mjs','--tsconfig','tsconfig.app.json','erase-restored.ts'])
  // An archive made before that erasure is refused whole when the later archive is named with --journal.
  await run(__rerTestEntryArgs([__rerTestEntry,'export','--output','exports/after-erasure.rer']))
  await run(__rerTestEntryArgs([__rerTestEntry,'reset','--yes']))
  await assert.rejects(run(__rerTestEntryArgs([__rerTestEntry,'import','--input','exports/first.rer','--journal','exports/after-erasure.rer','--yes'])),/erasure_epoch/)
  await run(__rerTestEntryArgs([__rerTestEntry,'import','--input','exports/after-erasure.rer','--journal','exports/after-erasure.rer','--yes']))
  const restored=await open()
  try { assert.equal(await restored.env.DB.prepare("SELECT COUNT(*) n FROM requests WHERE id='r'").first('n'),0,'the erased request stays erased') } finally { await restored.dispose() }
})
