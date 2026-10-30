import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,expect,inject,it} from 'vitest'
import {env,owner,call} from './support'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})

it('[DATA-001 BASE-ACCESS-002] recovery uses Base authority even when restored product data has no matching attribution',async()=>{
 const cookie=await owner()
 expect((await env.DB.prepare('SELECT email,display_name FROM operators').all()).results).toEqual([{email:'owner@penny.invalid',display_name:'Owner'}])
 // Native sign-in now creates a product actor for the agent door. Recreate
 // restored data without attribution while keeping the Base owner session.
 await env.DB.prepare('DELETE FROM operators').run()
 expect((await env.DB.prepare('SELECT * FROM operators').all()).results).toEqual([])
 await env.DB.prepare("INSERT INTO data_operations(id,kind,status,payload_json,created_at,updated_at) VALUES('interrupted-export','export','pending','{}','2026-10-07','2026-10-07')").run()
 await env.DB.prepare("UPDATE data_state SET phase='locked',lock_id='interrupted-export' WHERE singleton=1").run()
 expect((await call('/app/data',undefined,{...cookie,Accept:'text/html'})).status).toBe(200)
 expect((await env.DB.prepare('SELECT * FROM operators').all()).results).toEqual([])
 expect((await call('/api/operator/data/operations/interrupted-export/abort-export',{confirmPriorRunnerStopped:true},cookie)).status).toBe(204)
 expect(await env.DB.prepare('SELECT phase,lock_id FROM data_state').first()).toEqual({phase:'idle',lock_id:null})
 expect((await env.DB.prepare('SELECT * FROM operators').all()).results).toEqual([])
})
