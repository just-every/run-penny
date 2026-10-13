import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,expect,inject,it } from 'vitest'
import { call,env,owner } from './support'
import { apply,complete,importPath } from './feedback-import-fixture'
import { uservoiceFixture } from './uservoice-fixture'
import { exportArchive,restoreArchive } from '@/core/features/data/archive'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
const requests=async()=>(await env.DB.prepare('SELECT COUNT(*) n FROM requests').first<{n:number}>())!.n
const listed=async(operator:Record<string,string>)=>(await(await call(importPath+'/jobs',undefined,operator)).json() as {id:string}[]).map(job=>job.id)

it('[IMP-003][OWN-001] after export, reset, restore and setup the new owner sees, opens and undoes restored imports; a non-owner operator cannot',async()=>{
 const first=await owner(),source=uservoiceFixture('restored-a'),other=uservoiceFixture('restored-b')
 const jobs=[(await apply(source,first)).id,(await apply(other,first)).id]
 const snapshot=await exportArchive(env.DB,env.FILES)
 // Restore carries the import jobs but never the installation's authority; setup then claims a new owner.
 await reset();await applyD1Migrations(env.DB,inject('migrations'))
 const operator=await owner();await restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM oa_operators WHERE id=(SELECT principal_id FROM ik_jobs LIMIT 1)').first('n')).toBe(0)
 expect((await listed(operator)).sort()).toEqual([...jobs].sort())
 const originals=await call(importPath+'/jobs/'+jobs[0]+'/originals',undefined,operator);expect(originals.status,await originals.clone().text()).toBe(200)
 const read=await call(importPath+'/jobs/'+jobs[0],undefined,operator);expect(read.status,await read.clone().text()).toBe(200)
 const before=await requests();expect(before).toBeGreaterThan(0)
 const undo=await call(importPath+'/jobs/'+jobs[0]+'/undo',{},operator);expect(undo.status,await undo.clone().text()).toBe(200)
 expect((await complete(await undo.json() as {id:string;state:string;checkpoint:number},operator)).state).toBe('undone')
 expect(await requests()).toBeLessThan(before)
 // The same session stops being an owner: the other restored job is then nobody's to act on.
 await env.DB.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) SELECT 'second-owner','other@example.test','Other owner','owner','active',1,created_at FROM oa_operators").run()
 await env.DB.prepare("UPDATE oa_operators SET role='member' WHERE email='owner@penny.invalid'").run()
 await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id)').run()
 expect(await listed(operator)).toEqual([])
 const remaining=await requests()
 for(const [path,body,status] of [['/originals',undefined,409],['',undefined,409],['/undo',{},403]] as [string,object|undefined,number][])expect((await call(importPath+'/jobs/'+jobs[1]+path,body,operator)).status,path).toBe(status)
 expect(await requests()).toBe(remaining)
})
