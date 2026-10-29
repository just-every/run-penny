import { applyD1Migrations,type D1Migration } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { expect,inject,it } from 'vitest'
it('[BASE-OPS-002 DATA-001 REL-014 AI-010 AI-008] populated previous-head data and originals survive connector capture upgrades and repeat',async()=>{
 const {reset}=await import('cloudflare:test');await reset()
 const {populatePreviousPennySample}=await import('./previous-sample-fixture')
 const sample=(await import('../../sample-data/penny.v1.json')).default
 const migrations=inject('migrations') as D1Migration[]
 const quote=(identifier:string)=>`"${identifier.replaceAll('"','""')}"`
 const tableQuery="SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT IN ('d1_migrations','operator_sessions','native_requester_sessions','native_magic_links','local_auth_outbox') ORDER BY name"
 await applyD1Migrations(env.DB,migrations.filter(m=>m.name<'0009'))
 await populatePreviousPennySample(env.DB,sample)
 const historicOperators=(await env.DB.prepare('SELECT id,email FROM operators ORDER BY id').all<{id:string;email:string}>()).results
 const legacyOwner=await env.DB.prepare('SELECT id FROM operators ORDER BY id LIMIT 1').first<string>('id'),stamp=new Date().toISOString()
 await env.DB.prepare('INSERT INTO operator_sessions(id,operator_id,token_hash,expires_at,last_used_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind('old-session',legacyOwner,'prior-sha-hash','2099-01-01',stamp,stamp,stamp).run()

 const bytes=new Uint8Array([137,80,78,71,42]);await env.FILES.put('upgrade-preserved-bytes',bytes)
 const tables=(await env.DB.prepare(tableQuery).all<{name:string}>()).results
 const historical=await Promise.all(tables.map(async table=>({
  name:table.name,
  columns:(await env.DB.prepare(`PRAGMA table_info(${quote(table.name)})`).all<{name:string}>()).results.map(column=>column.name),
 })))
 const before=await env.DB.batch(historical.map(table=>env.DB.prepare(`SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)} ORDER BY rowid`)))
 // Populate the previous head through 0095 before applying additive Discord
 // capture tables, and compare every pre-existing column/row on upgrade and repeat.
 await applyD1Migrations(env.DB,migrations.filter(m=>m.name>='0009'&&m.name<'0096'))
 const releasedTables=(await env.DB.prepare(tableQuery).all<{name:string}>()).results
 const released=await Promise.all(releasedTables.map(async table=>({name:table.name,columns:(await env.DB.prepare(`PRAGMA table_info(${quote(table.name)})`).all<{name:string}>()).results.map(column=>column.name)})))
 const releasedRows=await env.DB.batch(released.map(table=>env.DB.prepare(`SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)} ORDER BY rowid`)))
 await applyD1Migrations(env.DB,migrations.filter(m=>m.name>='0096'&&m.name<'0097'))
 const upgradedRows=await env.DB.batch(released.map(table=>env.DB.prepare(`SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)} ORDER BY rowid`)))
 expect(upgradedRows.map(result=>result.results)).toEqual(releasedRows.map(result=>result.results))
 expect((await env.DB.prepare('SELECT * FROM penny_publication_schedules').all()).results).toEqual([])
 await applyD1Migrations(env.DB,migrations.filter(m=>m.name<'0097'))
 expect((await env.DB.batch(released.map(table=>env.DB.prepare(`SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)} ORDER BY rowid`)))).map(result=>result.results)).toEqual(upgradedRows.map(result=>result.results))
 const after=await env.DB.batch(historical.map(table=>env.DB.prepare(`SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)} ORDER BY rowid`)))
 expect(after.map(result=>result.results)).toEqual(before.map(result=>result.results))
 const applied=(await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY name').all<{name:string}>()).results.map(row=>row.name)
 expect(applied).toEqual(migrations.filter(m=>m.name<'0097').map(migration=>migration.name).sort())
 const addedColumns=[
  {table:'notification_attempts',name:'recipient_email',type:'TEXT',notnull:0,dflt_value:null},
  {table:'notification_attempts',name:'event_message_id',type:'TEXT',notnull:0,dflt_value:null},
  {table:'requester_update_permissions',name:'suppressed_at',type:'TEXT',notnull:0,dflt_value:null},
  {table:'requester_addresses',name:'verification_epoch',type:'INTEGER',notnull:1,dflt_value:'0'},
  {table:'notification_attempts',name:'recipient_verification_epoch',type:'INTEGER',notnull:0,dflt_value:null},
 ] as const
 for(const expected of addedColumns){
  const column=(await env.DB.prepare(`PRAGMA table_info(${quote(expected.table)})`).all<{name:string;type:string;notnull:number;dflt_value:string|null}>()).results.find(candidate=>candidate.name===expected.name)
  expect(column,`${expected.table}.${expected.name} added by 0011`).toMatchObject({name:expected.name,type:expected.type,notnull:expected.notnull,dflt_value:expected.dflt_value})
 }
 expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM requester_addresses WHERE verification_epoch!=0').first()).toEqual({count:0})
 expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM requester_update_permissions p JOIN requester_addresses a ON a.id=p.requester_address_id WHERE p.suppressed_at IS NOT a.suppressed_at').first()).toEqual({count:0})
 expect(new Uint8Array(await (await env.FILES.get('upgrade-preserved-bytes'))!.arrayBuffer())).toEqual(bytes)
 expect(await env.DB.prepare('SELECT revoked_at FROM operator_sessions WHERE id=?').bind('old-session').first()).toMatchObject({revoked_at:expect.any(String)})
 expect((await env.DB.prepare('SELECT * FROM oa_sessions').all()).results).toEqual([])
 expect((await env.DB.prepare('SELECT id,email,status FROM oa_operators ORDER BY id').all()).results).toEqual(historicOperators.map(o=>({...o,status:'active'})))
 expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM oa_operators').first()).toEqual(await env.DB.prepare('SELECT COUNT(*) AS count FROM operators').first())
 // Populate the previous Discord head before the source-check claim upgrade.
 const evidenceId=await env.DB.prepare('SELECT id FROM evidence_items ORDER BY id LIMIT 1').first<string>('id')
 const jobId='120000000000000001/120000000000000002/130000000000000001'
 await env.DB.prepare("UPDATE evidence_items SET source_type='discord' WHERE id=?").bind(evidenceId).run()
 await env.DB.prepare("INSERT INTO penny_discord_jobs(id,guild_id,channel_id,message_id,capturer_id,trigger_kind,owner_id,owner_version,actor_id,revision,state,evidence_id,created_at,updated_at) VALUES(?,'120000000000000001','120000000000000002','130000000000000001','120000000000000005','command',?,1,?,1,'done',?,?,?)").bind(jobId,legacyOwner,legacyOwner,evidenceId,stamp,stamp).run()
 await env.DB.prepare("INSERT INTO penny_discord_sources(evidence_id,job_id,guild_id,channel_id,message_id,jump_url,capturer_id,source_hash,source_state,next_check) VALUES(?,?,'120000000000000001','120000000000000002','130000000000000001','https://discord.com/channels/120000000000000001/120000000000000002/130000000000000001','120000000000000005',?,'current',?)").bind(evidenceId,jobId,'a'.repeat(64),stamp).run()
 const {digest}=await import('@/core/features/auth/native-tokens')
 await env.DB.prepare('INSERT INTO penny_discord_receipts(source_digest,created_at) VALUES(?,?)').bind(await digest(jobId),stamp).run()
 const priorTables=(await env.DB.prepare(tableQuery).all<{name:string}>()).results
 const prior=await Promise.all(priorTables.map(async table=>({name:table.name,columns:(await env.DB.prepare(`PRAGMA table_info(${quote(table.name)})`).all<{name:string}>()).results.map(column=>column.name)})))
 const snapshot=async()=> (await env.DB.batch(prior.map(table=>env.DB.prepare(`SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)} ORDER BY rowid`)))).map(result=>result.results)
 const discordBefore=await snapshot()
 await applyD1Migrations(env.DB,migrations.filter(m=>m.name<'0098'))
 expect(await snapshot()).toEqual(discordBefore)
 // The exact previous main schema is populated, including Discord provenance,
 // before adding Teams. Preserve every old row/column, authority and original.
 const previousTables=(await env.DB.prepare(tableQuery).all<{name:string}>()).results
 const previous=await Promise.all(previousTables.map(async table=>({name:table.name,columns:(await env.DB.prepare(`PRAGMA table_info(${quote(table.name)})`).all<{name:string}>()).results.map(column=>column.name)})))
 const previousSnapshot=async()=> (await env.DB.batch(previous.map(table=>env.DB.prepare(`SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)} ORDER BY rowid`)))).map(result=>result.results)
 const teamsBefore=await previousSnapshot()
 await applyD1Migrations(env.DB,migrations.filter(m=>m.name<'0100'))
 expect(await snapshot()).toEqual(discordBefore)
 expect(await previousSnapshot()).toEqual(teamsBefore)
 // Populate the exact writer-head Teams schema before the episode correction.
 // Its unresolved job and accepted notification receipt must survive upgrade.
 const teamsJob='11111111-1111-4111-8111-111111111111/19:feedback/1700000000010'
 await env.DB.prepare("INSERT INTO penny_teams_settings(singleton,team_id,channels_json,owner_id,owner_version,actor_id,enabled,revision,purge_days,updated_at) VALUES(1,'11111111-1111-4111-8111-111111111111','[\"19:feedback\"]',?,1,?,1,1,7,?)").bind(legacyOwner,legacyOwner,stamp).run()
 await env.DB.prepare("INSERT INTO penny_teams_jobs(id,team_id,channel_id,message_id,capturer_id,trigger_kind,owner_id,owner_version,actor_id,revision,state,failure,created_at,updated_at) VALUES(?,'11111111-1111-4111-8111-111111111111','19:feedback','1700000000010','capturing-member','action',?,1,?,1,'failed','teams_rate_limited',?,?)").bind(teamsJob,legacyOwner,legacyOwner,stamp,stamp).run()
 await env.DB.prepare("INSERT INTO penny_teams_deliveries(id,operator_id,revision,state,event_count,created_at,updated_at) VALUES('previous-accepted',?,1,'accepted',1,?,?)").bind(legacyOwner,stamp,stamp).run()
 const writerTables=(await env.DB.prepare(tableQuery).all<{name:string}>()).results
 const writer=await Promise.all(writerTables.map(async table=>({name:table.name,columns:(await env.DB.prepare(`PRAGMA table_info(${quote(table.name)})`).all<{name:string}>()).results.map(column=>column.name)})))
 const writerSnapshot=async()=> (await env.DB.batch(writer.map(table=>env.DB.prepare(`SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)} ORDER BY rowid`)))).map(result=>result.results)
 const writerBefore=await writerSnapshot()
 await applyD1Migrations(env.DB,migrations)
 expect(await writerSnapshot()).toEqual(writerBefore)
 await applyD1Migrations(env.DB,migrations)
 expect(await writerSnapshot()).toEqual(writerBefore)
 // First idle runtime reconstructs existing failure custody, not historical
 // notification effects. Repeating initialization leaves all old rows intact.
 const {initializeConnectorEpisodes}=await import('@/core/features/notifications/connector-episodes')
 const {createPennyRuntime}=await import('@/core/app/runtime')
 const events=await env.DB.prepare('SELECT count(*) n FROM penny_teams_events').first('n')
 await initializeConnectorEpisodes(createPennyRuntime(env));await initializeConnectorEpisodes(createPennyRuntime(env))
 expect(await writerSnapshot()).toEqual(writerBefore)
 expect(await env.DB.prepare("SELECT announce,state FROM penny_connector_episodes WHERE connector_key='teams'").first()).toEqual({announce:0,state:'active'})
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_teams_events').first('n')).toBe(events)
 expect(new Uint8Array(await (await env.FILES.get('upgrade-preserved-bytes'))!.arrayBuffer())).toEqual(bytes)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
