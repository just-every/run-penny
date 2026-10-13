import {applyD1Migrations,reset} from 'cloudflare:test'
import {afterEach,expect,inject,it,vi} from 'vitest'
import {env,call} from './support'
import {graph,time} from './notification-regression-fixture'
import {importPennySample} from '../../src/core/features/sample-data/service'
import {createDatabaseConnection} from '../../src/core/platform/database'
import sample from '../../sample-data/penny.v1.json'
import {priorUpgradeAuthority,clearUpgradeDevAdmission} from './prior-upgrade-authority'
const quote=(name:string)=>'"'+name.replaceAll('"','""')+'"'
afterEach(async()=>{await clearUpgradeDevAdmission();vi.restoreAllMocks()})
it('[BASE-OPS-002 BASE-ACCESS-002 DATA-001 NOTIFY-002] populated 0015 upgrades preserve product, native authority, erasure custody and files byte-for-byte',async()=>{
 await reset();const migrations=inject('migrations')
 await applyD1Migrations(env.DB,migrations.filter(m=>m.name<'0016'))
 await importPennySample(createDatabaseConnection(env.DB),sample)
 const g=await graph();await g.publish(0,'Pending original event')
 await env.DB.batch([
  env.DB.prepare("INSERT INTO attachments(id,request_id,storage_key,original_filename,content_type,byte_size,public_state,created_at,updated_at) VALUES('upgrade-file',?,'upgrade-original','Original.bin','application/octet-stream',4,'operator_only',?,?)").bind(g.requests[0].id,time(),time()),
  env.DB.prepare("INSERT INTO data_tombstones(epoch,table_name,key_hash) VALUES(1,'requests',?)").bind('a'.repeat(64)),
  env.DB.prepare('UPDATE data_state SET epoch=1'),
  env.DB.prepare("INSERT INTO data_operations(id,kind,status,payload_json,created_at,updated_at) VALUES('prior-export','export','complete','{}',?,?)").bind(time(),time()),
  env.DB.prepare("UPDATE oa_sessions SET revoked_at=100 WHERE id=(SELECT id FROM oa_sessions LIMIT 1)"),
 ])
 const bytes=new Uint8Array([0,255,31,9]);await env.FILES.put('upgrade-original',bytes)
 const names=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT IN ('d1_migrations','penny_public_admission') ORDER BY name").all<{name:string}>()).results.map(row=>row.name)
 const columns=await Promise.all(names.map(async name=>(await env.DB.prepare(`PRAGMA table_info(${quote(name)})`).all<{name:string}>()).results.map(row=>row.name)))
 const statements=names.map((name,i)=>env.DB.prepare(`SELECT ${columns[i].map(quote).join(',')} FROM ${quote(name)} ORDER BY rowid`))
 const before=(await env.DB.batch(statements)).map(result=>result.results)
 await applyD1Migrations(env.DB,migrations)
 expect((await env.DB.batch(statements)).map(result=>result.results)).toEqual(before)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM notification_intents WHERE restoration_hold_at IS NOT NULL').first('n')).toBe(0)
 expect((await call('/auth/session',undefined,g.operator)).status).toBe(401)
 expect(new Uint8Array(await (await env.FILES.get('upgrade-original'))!.arrayBuffer())).toEqual(bytes)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
 await applyD1Migrations(env.DB,migrations)
 expect((await env.DB.batch(statements)).map(result=>result.results)).toEqual(before)
 expect((await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY name').all<{name:string}>()).results.map(row=>row.name)).toEqual(migrations.map(m=>m.name))
})

it('[DATA-001 DATA-003 BASE-OPS-002 BASE-ACCESS-002] populated 0029 clause upgrade preserves every prior column, authority, snapshot, delivery, original and tombstone; repeats without changes',async()=>{
 await reset()
 const migrations=inject('migrations'),prior=migrations.filter(m=>m.name<'0030'),added=migrations.filter(m=>m.name>='0030')
 await applyD1Migrations(env.DB,prior)
 const {owner}=await import('./support'),{priorClauseGraph,originalBytes}=await import('../data/prior-clause-graph.mjs')
 const operator=await owner()
 expect((await call('/api/operator/loop/options',undefined,operator)).status).toBe(200)
 const actor=(await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())!.id
 await priorClauseGraph(env.DB,env.FILES,actor)
 const {digest,opaqueToken}=await import('../../src/core/features/auth/native-tokens'),token=opaqueToken(),person={Authorization:`Bearer ${token}`}
 await env.DB.prepare("UPDATE native_requester_sessions SET token_hash=? WHERE id='prior-requester-session'").bind(await digest(token)).run()
 const checkAuthority=await priorUpgradeAuthority(operator)
 await checkAuthority()
 const names=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT IN ('d1_migrations','penny_public_admission') ORDER BY name").all<{name:string}>()).results.map(row=>row.name)
 const columns=await Promise.all(names.map(async name=>(await env.DB.prepare(`PRAGMA table_info(${quote(name)})`).all<{name:string}>()).results.map(row=>row.name)))
 const statements=names.map((name,i)=>env.DB.prepare(`SELECT ${columns[i].map(quote).join(',')} FROM ${quote(name)} ORDER BY rowid`))
 const before=(await env.DB.batch(statements)).map(result=>result.results)
 const preserved=async()=>{
  expect((await env.DB.batch(statements)).map(result=>result.results)).toEqual(before)
  expect(new Uint8Array(await (await env.FILES.get('prior-original'))!.arrayBuffer())).toEqual(originalBytes)
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
 }
 for(const migration of added){await applyD1Migrations(env.DB,[migration]);await preserved()}
 await applyD1Migrations(env.DB,migrations)
 await preserved()
 await checkAuthority()
 // The newly shipped public doors operate on historical records, without replacing their IDs or frozen history.
 const edited=await call('/api/operator/evidence/prior-evidence/wording',{wording:'Revised after upgrade',expectedVersionId:'prior-evidence-version'},operator,'PATCH')
 expect(edited.status,await edited.clone().text()).toBe(200)
 const versions=await call('/api/operator/evidence/prior-evidence/versions',undefined,operator)
 expect(versions.status).toBe(200)
 expect(await versions.text()).toContain('Original evidence wording')
 expect(await env.DB.prepare("SELECT COUNT(*) n FROM evidence_versions WHERE evidence_id='prior-evidence'").first('n')).toBe(2)
 const attachment=await call('/api/operator/evidence-attachments/prior-attachment',undefined,operator)
 expect(attachment.status).toBe(200);expect(new Uint8Array(await attachment.arrayBuffer())).toEqual(originalBytes)
 const subscribed=await call('/api/public/updates/subscription',{subscribed:true},person,'PATCH')
 expect(subscribed.status,await subscribed.clone().text()).toBe(200)
 const outcome=await call('/api/public/releases/prior-release/outcomes',{targetId:'prior-item',outcome:'adopted'},person,'PUT')
 expect(outcome.status,await outcome.clone().text()).toBe(200)
 expect(await env.DB.prepare("SELECT outcome FROM release_outcomes WHERE release_version_id='prior-release-version'").first('outcome')).toBe('adopted')
 const corrected=await call('/api/operator/releases/prior-release/corrections',{expectedVersionId:'prior-release-version',title:'Corrected release',body:'Corrected after upgrade'},operator)
 expect(corrected.status,await corrected.clone().text()).toBe(201)
 expect(await env.DB.prepare("SELECT title,body FROM release_versions WHERE id='prior-release-version'").first()).toEqual({title:'Original release title',body:'Original release body'})
 expect(await env.DB.prepare("SELECT delivery_state,provider_message_id FROM notification_outbox WHERE id='prior-delivery'").first()).toEqual({delivery_state:'delivered',provider_message_id:'historical-provider-receipt'})
 const revised=await call('/api/operator/decisions/prior-decision/revisions',{expectedRevision:1,selectedCandidateBetId:'prior-selected',rationale:'Reconsidered after upgrade',ownerOperatorId:actor,confidence:'medium',reviewAt:'2099-02-01'},operator)
 expect(revised.status,await revised.clone().text()).toBe(201)
 expect(await env.DB.prepare("SELECT rationale FROM decision_revisions WHERE id='prior-revision'").first('rationale')).toBe('Original commitment rationale')
 expect(await env.DB.prepare("SELECT evidence_version_id FROM decision_evidence_snapshots WHERE id='prior-evidence-snapshot'").first('evidence_version_id')).toBe('prior-evidence-version')
 expect(await env.DB.prepare("SELECT COUNT(*) n FROM decision_revisions WHERE decision_id='prior-decision'").first('n')).toBe(2)
 const history=await call('/api/operator/decisions/prior-decision/history',undefined,operator)
 expect(history.status).toBe(200);expect(await history.text()).toContain('Original commitment rationale')
 const review=await call('/api/operator/decisions/prior-decision/reviews',{note:'Reviewed the historical commitment',reviewAt:'2099-03-01'},operator)
 expect(review.status,await review.clone().text()).toBe(201)
 const postRelease=await call('/api/operator/decisions/prior-decision/post-release',undefined,operator)
 expect(postRelease.status).toBe(200);expect(await postRelease.text()).toContain('adopted')
 console.log(JSON.stringify({scope:'populated 0029 upgrade',priorRows:Object.fromEntries(names.map((name,i)=>[name,before[i].length]).filter(([,count])=>count)),allPriorColumnsUnchanged:true,eachMigrationPreserved:true,repeatedApplyUnchanged:true,originalFiles:1}))
})
