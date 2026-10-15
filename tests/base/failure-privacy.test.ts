import { applyD1Migrations,reset } from 'cloudflare:test'
import { afterEach,beforeEach,expect,inject,it,vi } from 'vitest'
import { call,env,owner } from './support'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>{vi.restoreAllMocks()})

it('[BASE-SECRET-001] an unexpected storage failure answers the standard error and logs no secret or personal value',async()=>{
 const operator=await owner(),person='private.person@example.test',secret='synthetic-base-auth-secret-for-worker-tests',logged:string[]=[]
 for(const level of ['error','warn','log','info'] as const)vi.spyOn(console,level).mockImplementation((...args:unknown[])=>{logged.push(args.map(arg=>arg instanceof Error?`${arg.message} ${arg.stack}`:String(arg)).join(' '))})
 // The storage edge fails with a message carrying an address and a secret.
 vi.spyOn(env.DB,'batch').mockRejectedValue(new Error(`D1 refused ${person} for ${secret}`))
 const response=await call('/api/operator/catalog/tags',{name:'Private tag'},operator),body=await response.text()
 expect(response.status).toBe(503)
 expect(logged.length).toBeGreaterThan(0)
 for(const text of [body,...logged]){expect(text).not.toContain(person);expect(text).not.toContain(secret)}
})
