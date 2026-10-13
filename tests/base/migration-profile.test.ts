import { applyD1Migrations, reset } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { expect, inject, it } from 'vitest'
it('[BASE-OPS-002 DATA-001 BASE-ACCESS-002] production Base profile applies the exact complete on-disk migration history',async()=>{
 await reset()
 const migrations=inject('migrations'),names=inject('fullMigrationNames')
 expect(migrations.map(migration=>migration.name).sort()).toEqual(names)
 await applyD1Migrations(env.DB,migrations)
 const applied=(await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY name').all<{name:string}>()).results.map(row=>row.name)
 expect(applied).toEqual(names)
 expect(applied).toContain('0009_base_operator_auth.sql')
 expect(applied).toContain('0012_base_local_auth.sql')
 for(const name of ['oa_operators','oa_tokens','oa_sessions','oa_invitation_cancellations','rer_mail_development_outbox','notification_batches','mail_event_records'])expect(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(name).first('name')).toBe(name)
})
