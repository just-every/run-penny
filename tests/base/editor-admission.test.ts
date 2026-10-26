import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,expect,inject,it} from 'vitest'
import {createPennyApi} from '@/core/app/api'
import {env,origin,owner} from './support'
import type {AppBindings} from '@/core/shared/bindings'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
it('[BASE-ACCESS-004][EDIT-001] returns a short owner-only editor lease with no authority values and rejects foreign-origin configuration',async()=>{
 const bindings={...env,RER_MANAGEMENT_ORIGIN:'https://manage.example.test',RER_INSTALLATION_ID:'penny-native-test'} as AppBindings,api=createPennyApi()
 const request=(headers:Record<string,string>={},method='GET')=>api.fetch(new Request(origin+'/api/editor/config',{method,headers:{Host:'penny.test',Origin:origin,...headers}}),bindings)
 expect((await request()).status).toBe(401);expect((await request({Authorization:'Bearer test-requester'})).status).toBe(401)
 const operator=await owner()
 // [EDIT-001 BASE-PUBLIC-002] Refuse unsafe configuration before granting this owner a lease.
 const configurationRequest=new Request(origin+'/api/editor/config',{headers:{Origin:origin,...operator}})
 expect((await api.fetch(new Request(configurationRequest.url,{headers:configurationRequest.headers}),env)).status).toBe(503)
 const unsafeBindings={...env,RER_MANAGEMENT_ORIGIN:'https://user:password@manage.example.test',RER_INSTALLATION_ID:'test-installation'} as AppBindings
 expect((await api.fetch(new Request(configurationRequest.url,{headers:configurationRequest.headers}),unsafeBindings)).status).toBe(503)
 const response=await request(operator),grant=await response.json() as {config:{enabled:boolean;managementOrigin:string};expiresAt:number}
 expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toContain('no-store');expect(grant.config.enabled).toBe(true)
 expect(grant.config.managementOrigin).toBe(bindings.RER_MANAGEMENT_ORIGIN);expect(grant.expiresAt).toBeGreaterThan(Date.now())
 const serialized=JSON.stringify(grant);expect(serialized).not.toContain(bindings.AUTH_SECRET);expect(serialized).not.toContain(bindings.SETUP_TOKEN)
 expect((await request({...operator,Origin:'https://foreign.example.test'})).status).toBe(403)
 expect((await request(operator,'POST')).status).toBe(405)
 await env.DB.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) SELECT 'second-owner','other@example.test','Other owner','owner','active',1,created_at FROM oa_operators WHERE email='owner@penny.invalid'").run()
 await env.DB.prepare("UPDATE oa_operators SET role='member',version=version+1 WHERE email='owner@penny.invalid'").run()
 expect((await request(operator)).status).toBe(401)
 // A current native non-owner session remains an equal product operator but
 // does not acquire configuration authority from that equality policy.
 await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id)').run()
 expect((await request(operator)).status).toBe(403)
 await env.DB.prepare("UPDATE oa_operators SET status='inactive',version=version+1 WHERE email='owner@penny.invalid'").run()
 expect((await request(operator)).status).toBe(401)
})
