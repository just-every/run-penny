import { applyD1Migrations,reset,type D1Migration } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { expect,inject,it } from 'vitest'
it('[BASE-ACCESS-002 DATA-001] local auth upgrade preserves prior product and authentication rows and adds cancellation custody',async()=>{
 await reset();const migrations=inject('migrations') as D1Migration[]
 await applyD1Migrations(env.DB,migrations.filter(m=>m.name<'0012'))
 await env.DB.batch([
  env.DB.prepare("INSERT INTO oa_operators VALUES('owner','prior@example.test','Prior owner','owner','active',1,100)"),
  env.DB.prepare("INSERT INTO oa_operators VALUES('invited','invited@example.test','Invited','member','invited',1,100)"),
  env.DB.prepare("INSERT INTO oa_bootstrap VALUES(1,'prior-claim',100)"),
  env.DB.prepare("INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES('prior-session','prior-hash','owner',1,'native',100,9999999999999)"),
  env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('prior-board','prior','Prior board','public',0,'now','now')"),
 ])
 const tables=['oa_operators','oa_bootstrap','oa_sessions','boards']
 const before=await env.DB.batch(tables.map(t=>env.DB.prepare(`SELECT * FROM ${t} ORDER BY rowid`)))
 await applyD1Migrations(env.DB,migrations.filter(m=>m.name>='0012'))
 const after=await env.DB.batch(tables.map(t=>env.DB.prepare(`SELECT * FROM ${t} ORDER BY rowid`)))
 expect(after.map(r=>r.results)).toEqual(before.map(r=>r.results))
 expect((await env.DB.prepare('SELECT * FROM oa_invitation_cancellations').all()).results).toEqual([])
 expect((await env.DB.prepare('SELECT * FROM rer_mail_development_outbox').all()).results).toEqual([])
 await env.DB.prepare("UPDATE oa_operators SET status='inactive' WHERE id='invited'").run()
 expect(await env.DB.prepare('SELECT operator_id FROM oa_invitation_cancellations').first()).toEqual({operator_id:'invited'})
 await expect(env.DB.prepare("UPDATE oa_operators SET status='active' WHERE id='invited'").run()).rejects.toThrow('invitation_required')
})
