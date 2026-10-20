import { applyD1Migrations,type D1Migration } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { expect,inject,it } from 'vitest'
it('[BASE-OPS-002 DATA-001 REL-014 AI-010] populated v0.1.4 data and originals survive scheduling and model configuration upgrades and repeat',async()=>{
 const {reset}=await import('cloudflare:test');await reset()
 const {populatePreviousPennySample}=await import('./previous-sample-fixture')
 const sample=(await import('../../sample-data/penny.v1.json')).default
 const migrations=inject('migrations') as D1Migration[]
 const quote=(identifier:string)=>`"${identifier.replaceAll('"','""')}"`
 const tableQuery="SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT IN ('d1_migrations','operator_sessions','native_requester_sessions','native_magic_links','local_auth_outbox') ORDER BY name"
 await applyD1Migrations(env.DB,migrations.filter(m=>m.name<'0009'))
 await populatePreviousPennySample(env.DB,sample)
 const legacyOwner=await env.DB.prepare('SELECT id FROM operators ORDER BY id LIMIT 1').first<string>('id'),stamp=new Date().toISOString()
 await env.DB.prepare('INSERT INTO operator_sessions(id,operator_id,token_hash,expires_at,last_used_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind('old-session',legacyOwner,'prior-sha-hash','2099-01-01',stamp,stamp,stamp).run()

 const bytes=new Uint8Array([137,80,78,71,42]);await env.FILES.put('upgrade-preserved-bytes',bytes)
 const tables=(await env.DB.prepare(tableQuery).all<{name:string}>()).results
 const historical=await Promise.all(tables.map(async table=>({
  name:table.name,
  columns:(await env.DB.prepare(`PRAGMA table_info(${quote(table.name)})`).all<{name:string}>()).results.map(column=>column.name),
 })))
 const before=await env.DB.batch(historical.map(table=>env.DB.prepare(`SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)} ORDER BY rowid`)))
 // v0.1.4 released the schema through 0085. Populate it before applying the
 // new additive schedule and AI migrations, and compare every pre-existing column/row.
 await applyD1Migrations(env.DB,migrations.filter(m=>m.name>='0009'&&m.name<'0086'))
 const releasedTables=(await env.DB.prepare(tableQuery).all<{name:string}>()).results
 const released=await Promise.all(releasedTables.map(async table=>({name:table.name,columns:(await env.DB.prepare(`PRAGMA table_info(${quote(table.name)})`).all<{name:string}>()).results.map(column=>column.name)})))
 const releasedRows=await env.DB.batch(released.map(table=>env.DB.prepare(`SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)} ORDER BY rowid`)))
 await applyD1Migrations(env.DB,migrations.filter(m=>m.name>='0086'))
 const upgradedRows=await env.DB.batch(released.map(table=>env.DB.prepare(`SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)} ORDER BY rowid`)))
 expect(upgradedRows.map(result=>result.results)).toEqual(releasedRows.map(result=>result.results))
 expect((await env.DB.prepare('SELECT * FROM penny_publication_schedules').all()).results).toEqual([])
 await applyD1Migrations(env.DB,migrations)
 expect((await env.DB.batch(released.map(table=>env.DB.prepare(`SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)} ORDER BY rowid`)))).map(result=>result.results)).toEqual(upgradedRows.map(result=>result.results))
 const after=await env.DB.batch(historical.map(table=>env.DB.prepare(`SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)} ORDER BY rowid`)))
 expect(after.map(result=>result.results)).toEqual(before.map(result=>result.results))
 const applied=(await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY name').all<{name:string}>()).results.map(row=>row.name)
 expect(applied).toEqual(migrations.map(migration=>migration.name).sort())
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
 expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM oa_operators').first()).toEqual(await env.DB.prepare('SELECT COUNT(*) AS count FROM operators').first())
})
