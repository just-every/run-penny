import {mcpProof} from './mcp-client'
import { previousNotificationGraph } from './previous-notification-fixture'
import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,afterEach,expect,inject,it,vi} from 'vitest'
import {createPennyApi} from '@/core/app/api'
import {env,origin,owner} from './support'
import {observeD1} from './review-race-storage'
import {graph} from './notification-regression-fixture'
const api=createPennyApi()
function request(path:string,body?:unknown,headers:Record<string,string>={},method=body===undefined?'GET':'POST',db=env.DB){
 return api.fetch(new Request(origin+path,{method,headers:{Origin:origin,...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),{...env,DB:db})
}
async function key(operator:Record<string,string>,scopes:string[]){
 const response=await request('/api/operator/integrations/keys',{name:'Native integration',scopes},operator)
 expect(response.status,await response.clone().text()).toBe(201)
 const result=await response.json() as {token:string;credential:{id:string}}
 return {...result,headers:{Authorization:'Bearer '+result.token}}
}
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
it('[API-001 BASE-ACCESS-002] issues a reveal-once hashed key, confines route-selected scopes to the REST namespace and refuses unissued keys without a usage record',async()=>{
 const operator=await owner(),issued=await key(operator,['requests:read']),unknown={Authorization:'Bearer int_'+'0'.repeat(64)}
 expect(await env.DB.prepare('SELECT token_hash FROM integration_tokens').first('token_hash')).not.toBe(issued.token)
 const listed=await request('/api/operator/integrations/keys',undefined,operator),listing=await listed.text()
 expect(listing).not.toContain(issued.token);expect(listing).not.toContain('token_hash')
 expect((await request('/api/v1/requests',undefined,issued.headers)).status).toBe(200)
 for(const path of ['/api/operator/requests','/api/operator/data/export','/api/editor/config'])expect((await request(path,undefined,issued.headers)).status).toBe(401)
 for(const headers of [{},{Authorization:'Bearer wrong'},unknown,issued.headers])expect((await request('/api/v1/requests',{title:'Attempt',description:'Body',boardSlug:'missing'},headers)).status).toBe(401)
 expect((await request('/api/v1/releases',undefined,issued.headers)).status).toBe(401)
 expect((await request('/api/v1/requests',{resource:'releases'},issued.headers)).status).toBe(401);for(let attempt=0;attempt<3;attempt++)expect((await request('/api/v1/requests',undefined,unknown)).status).toBe(401)
 const usage=(await env.DB.prepare('SELECT token_id,resource,required_scopes,allowed FROM integration_token_usage').all()).results
 expect(usage.some(row=>row.resource==='requests'&&row.allowed===1)).toBe(true)
 expect(usage.some(row=>row.resource==='requests'&&row.allowed===0)).toBe(true);expect(usage.every(row=>row.token_id===issued.credential.id),'a made-up key leaves no usage record').toBe(true)
 expect(await env.DB.prepare('SELECT count(*) n FROM requests').first('n')).toBe(0)
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_api_issuance').first('n')).toBe(0)
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_integration_guards').first('n')).toBe(0)
})
it('[API-001 API-002] expiry, revocation, issuer removal and usage-write failure refuse authority after a fresh runtime',async()=>{
 const operator=await owner(),issued=await key(operator,['requests:read'])
 const restarted=createPennyApi()
 expect((await restarted.fetch(new Request(origin+'/api/v1/requests',{headers:issued.headers}),env)).status).toBe(200)
 await env.DB.prepare('UPDATE integration_tokens SET expires_at=1').run();expect((await request('/api/v1/requests',undefined,issued.headers)).status).toBe(401)
 await env.DB.prepare('UPDATE integration_tokens SET expires_at=NULL').run()
 expect((await request('/api/operator/integrations/keys/'+issued.credential.id,{},operator,'DELETE')).status).toBe(200)
 expect((await request('/api/v1/requests',undefined,issued.headers)).status).toBe(401)
 const next=await key(operator,['requests:read'])
 let failed=false
 const db=observeD1(env.DB,{before:async sql=>{if(sql.some(s=>s.includes('INSERT INTO integration_token_usage'))){failed=true;throw Error('Test-only durable usage failure')}}})
 expect((await request('/api/v1/requests',undefined,next.headers,'GET',db)).status).toBe(503);expect(failed).toBe(true)
 await env.DB.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES('other-owner','other@example.test','Other','owner','active',1,1)").run()
 await env.DB.prepare("UPDATE oa_operators SET status='inactive',version=version+1 WHERE email='owner@penny.invalid'").run()
 expect((await request('/api/v1/requests',undefined,next.headers)).status).toBe(401)
 await env.DB.prepare("UPDATE oa_operators SET status='active',version=version+1 WHERE email='owner@penny.invalid'").run()
 expect((await request('/api/v1/requests',undefined,next.headers)).status).toBe(401)
})
it('[API-002 BASE-ACCESS-002] fences issuance and business writes against native revocation in their D1 transaction',async()=>{
 const operator=await owner()
 let changed=false
 const issueDb=observeD1(env.DB,{before:async sql=>{if(!changed&&sql.some(s=>s.includes('INSERT INTO integration_tokens'))){changed=true;await env.DB.prepare('UPDATE oa_sessions SET revoked_at=1').run()}}})
 expect((await request('/api/operator/integrations/keys',{name:'Race',scopes:['requests:write']},operator,'POST',issueDb)).status).toBe(401)
 expect(changed).toBe(true);expect(await env.DB.prepare('SELECT count(*) n FROM integration_tokens').first('n')).toBe(0)
 await env.DB.prepare('UPDATE oa_sessions SET revoked_at=NULL').run()
 const issued=await key(operator,['requests:write']),stamp=new Date().toISOString()
 await env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('board','feedback','Feedback','public',0,?,?)").bind(stamp,stamp).run()
 changed=false
 const audited=await env.DB.prepare('SELECT count(*) n FROM audit_entries').first('n')
 const businessDb=observeD1(env.DB,{before:async sql=>{if(!changed&&sql.some(s=>s.includes('INSERT INTO requests'))){changed=true;await env.DB.prepare('UPDATE integration_tokens SET revoked_at=1').run()}}})
 const result=await request('/api/v1/requests',{title:'New request',description:'Original body',boardSlug:'feedback'},issued.headers,'POST',businessDb)
 expect(result.status).toBe(401);expect(changed).toBe(true)
 expect(await env.DB.prepare('SELECT count(*) n FROM requests').first('n')).toBe(0)
 expect(await env.DB.prepare('SELECT count(*) n FROM audit_entries').first('n')).toBe(audited)
 expect(await env.DB.prepare("SELECT count(*) n FROM audit_entries WHERE action='integration.key_issued'").first('n')).toBe(1)
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_integration_guards').first('n')).toBe(0)
})
it('[API-003 REQ-010 REL-001] composes native public reads, comments, status publication and validation without widening approval or consent',async()=>{
 const g=await graph(),issued=await key(g.operator,['requests:read','requests:write','comments:read','comments:write','status:read','status:write','releases:read','releases:write'])
 await mcpProof(g.operator,g.requests[0].slug)
 const slug=g.requests[0].slug
 const snapshot=async()=>({requests:await env.DB.prepare('SELECT count(*) n FROM requests').first('n'),comments:await env.DB.prepare('SELECT count(*) n FROM request_comments').first('n'),updates:await env.DB.prepare('SELECT count(*) n FROM request_status_updates').first('n'),permissions:await env.DB.prepare('SELECT count(*) n FROM requester_update_permissions').first('n')})
 const before=await snapshot()
 expect((await request('/api/v1/requests/'+slug+'/comments',{body:'Comment without approval'},issued.headers)).status).toBe(400)
 expect((await request('/api/v1/requests',{title:'New',description:'Body',boardSlug:'missing'},issued.headers)).status).toBe(404)
 expect((await request('/api/v1/requests',{title:'New',description:'Body',boardSlug:'regression',resource:'releases'},issued.headers)).status).toBe(400)
 expect(await snapshot()).toEqual(before)
 expect((await request('/api/v1/requests/'+slug+'/comments',{body:'Approved safe comment',approve:true},issued.headers)).status).toBe(201)
 const action={status:'under_review',body:'Approved public update',pinned:false,idempotencyKey:'native-api-update',approve:true}
 expect((await request('/api/v1/requests/'+slug+'/status-updates',action,issued.headers)).status).toBe(200)
 expect((await request('/api/v1/requests/'+slug+'/status-updates',action,issued.headers)).status).toBe(200)
 expect((await request('/api/v1/requests/'+slug+'/status-updates',{...action,body:'Different'},issued.headers)).status).toBe(409)
 expect(await env.DB.prepare('SELECT count(*) n FROM request_status_updates').first('n')).toBe(1)
 expect(await env.DB.prepare('SELECT count(*) n FROM requester_update_permissions').first('n')).toBe(before.permissions)
 const publicText=await (await request('/api/v1/requests/'+slug,undefined,issued.headers)).text()
 expect(publicText).toContain('Approved safe comment');expect(publicText).toContain('Approved public update');expect(publicText).not.toContain(g.recipient.email)
 expect((await request('/api/v1/releases/missing/publish',{approve:true},issued.headers)).status).toBe(404)
 const fresh=await request('/api/v1/requests',{title:'Private unreviewed wording',description:'Private context',boardSlug:'regression'},issued.headers)
 expect(fresh.status).toBe(201)
 expect(await (await request('/api/v1/requests',undefined,issued.headers)).text()).not.toContain('Private unreviewed wording')
})
it('[API-002 BASE-OPS-002 DATA-001] applies each new migration to populated prior native history and preserves revoked authority, files and seals',async()=>{
 const migrations=inject('migrations'),boundary=migrations.findIndex(item=>item.name.startsWith('0020_'))
 await reset();await applyD1Migrations(env.DB,migrations.slice(0,boundary))
 const g=await previousNotificationGraph();await g.publish(0,'Preserved status')
 const {applyPreviousFeedback,feedbackFixture}=await import('./feedback-import-fixture')
 await applyPreviousFeedback(feedbackFixture('api-upgrade-history'),g.operator)
 expect(await env.DB.prepare('SELECT count(*) n FROM feedback_import_records').first('n')).toBe(19)
 await env.DB.prepare('UPDATE oa_sessions SET revoked_at=1').run()
 const definitions=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name").all<{name:string}>()).results
 const tables=await Promise.all(definitions.map(async({name})=>({name,columns:(await env.DB.prepare('PRAGMA table_info("'+name+'")').all<{name:string}>()).results.map(column=>column.name)})))
 const read=async()=>(await env.DB.batch(tables.map(({name,columns})=>env.DB.prepare('SELECT '+columns.map(column=>'"'+column+'"').join(',')+' FROM "'+name+'" ORDER BY rowid')))).map(r=>r.results)
 const before=await read(),bytes=new Uint8Array([1,255,42]);await env.FILES.put('api-upgrade-original',bytes)
 for(const migration of migrations.slice(boundary)){await applyD1Migrations(env.DB,[migration]);expect(await read()).toEqual(before)}
 await applyD1Migrations(env.DB,migrations);expect(await read()).toEqual(before)
 expect(new Uint8Array(await(await env.FILES.get('api-upgrade-original'))!.arrayBuffer())).toEqual(bytes)
 expect((await request('/api/operator/integrations/keys',undefined,g.operator)).status).toBe(401)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
