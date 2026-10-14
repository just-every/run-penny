import {applyD1Migrations,reset} from 'cloudflare:test'
import {env} from 'cloudflare:workers'
import {expect,inject,it} from 'vitest'
import {createPennyApi} from '@/core/app/api'
it('[LEARN-006] populated previous-head upgrade preserves every prior row and authority and is a repeated no-op',async()=>{
 await reset();const migrations=inject('migrations');await applyD1Migrations(env.DB,migrations.filter(m=>m.name<'0059'))
 const app=createPennyApi(),call=(path:string,body:unknown,cookie='')=>app.fetch(new Request('https://penny.test'+path,{method:'POST',headers:{Host:'penny.test',Origin:'https://penny.test',Cookie:cookie,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.80'},body:JSON.stringify(body)}),env)
 const bootstrap=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Upgrade owner'});expect(bootstrap.status).toBe(303);const cookie=bootstrap.headers.get('set-cookie')!.split(';')[0]
 const evidence=await call('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Prior record',wording:'Prior customer context',observedAt:'2026-10-01T00:00:00Z'},cookie);expect(evidence.status).toBe(201)
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name").all<{name:string}>()).results
 const read=()=>env.DB.batch(tables.map(t=>env.DB.prepare(`SELECT * FROM "${t.name}" ORDER BY rowid`)))
 const before=(await read()).map(r=>r.results);await applyD1Migrations(env.DB,migrations);expect((await read()).map(r=>r.results)).toEqual(before)
 await applyD1Migrations(env.DB,migrations);expect((await read()).map(r=>r.results)).toEqual(before);expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
 const readApi=await app.fetch(new Request('https://penny.test/api/operator/learning',{headers:{Cookie:cookie,Host:'penny.test'}}),env);expect(readApi.status).toBe(200);expect((await readApi.json() as {investigations:unknown[]}).investigations).toEqual([])
})
