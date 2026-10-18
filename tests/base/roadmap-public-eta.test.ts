import { applyD1Migrations, reset } from 'cloudflare:test'
import { beforeAll, expect, inject, it } from 'vitest'
import { env, seedLoop, request, json, document, committed, publicRequest, approve } from './decision-loop-fixture'

beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'));await seedLoop();const s=await json<any>(request('/api/operator/settings/status-roadmap'));await json(request('/api/operator/settings/status-roadmap','PUT',{...s.settings,source:'approved_items'}))})
const publication=(id:string)=>env.DB.prepare('SELECT * FROM roadmap_publications WHERE roadmap_item_id=?').bind(id).first<any>()

it('[ROAD-012] explicitly approves coarse ETAs, drafts each change once, preserves internal dates and refuses stale, private or unauthorised writes',async()=>{
 const c=await committed(),r=await publicRequest()
 await env.DB.prepare("UPDATE roadmap_items SET target_window='2031-02-19 internal contract date' WHERE id=?").bind(c.itemId).run()
 expect((await request(`/api/operator/roadmap/${c.itemId}/public-eta`,'PUT',{publicEta:'2031-Q2',approvalId:'missing'})).status).toBe(409)
 await approve(c.itemId,[r.id]);const p=await publication(c.itemId)
 const eta=(value:string|null,headers?:Record<string,string>)=>request(`/api/operator/roadmap/${c.itemId}/public-eta`,'PUT',{publicEta:value,approvalId:p.id},headers)
 expect(await json(request(`/api/public/roadmap/${p.public_slug}`))).toMatchObject({publicEta:null})
 for(const bad of ['2031-02-19','2031-13','soon','2031-Q5'])expect((await eta(bad)).status).toBe(400)
 expect((await eta('2031-Q2',{Cookie:''})).status).toBe(401)
 expect((await eta('2031-Q2',{Origin:'https://elsewhere.test'})).status).toBe(403)
 await json(eta('2031-Q2'))
 const drafts=()=>env.DB.prepare('SELECT * FROM roadmap_update_versions WHERE roadmap_item_id=? ORDER BY version_number').bind(c.itemId).all<any>()
 expect((await drafts()).results).toMatchObject([{published_at:null,public_status:'planned',body:expect.stringContaining('ETA 2031-Q2')}])
 expect((await env.DB.prepare('SELECT request_id FROM roadmap_update_targets WHERE version_id=?').bind((await drafts()).results[0].id).all()).results).toEqual([{request_id:r.id}])
 await json(eta('2031-Q2'));expect((await drafts()).results).toHaveLength(1)
 for(const path of ['/api/public/roadmap',`/api/public/roadmap/${p.public_slug}`]){const text=await (await request(path)).text();expect(text).toContain('2031-Q2');expect(text).not.toContain('2031-02-19')}
 const html=await (await document(`/portal/roadmap/${p.public_slug}`)).text();expect(html).toContain('2031-Q2');expect(html).not.toContain('2031-02-19')
 // An ETA approval must not override the newer direct status on a mapped request.
 await json(request(`/api/operator/requests/${r.slug}/status-updates`,'POST',{status:'under_review',body:''}))
 await json(eta('2031-06'));expect(await json(request(`/api/public/requests/${r.slug}`))).toMatchObject({status:'under_review'})
 await json(eta(null));expect(await json(request(`/api/public/roadmap/${p.public_slug}`))).toMatchObject({publicEta:null});expect((await drafts()).results).toHaveLength(3)
 expect((await drafts()).results[2].body).toContain('ETA removed')
 const before=await publication(c.itemId)
 await env.DB.exec("CREATE TRIGGER reject_eta_draft BEFORE INSERT ON roadmap_update_versions BEGIN SELECT RAISE(ABORT,'eta draft failure'); END")
 try{expect((await eta('2031-Q3')).status).toBe(503)}finally{await env.DB.exec('DROP TRIGGER reject_eta_draft')}
 expect(await publication(c.itemId)).toEqual(before)
 await approve(c.itemId,[r.id]);expect((await eta('2031-Q4')).status).toBe(409)
 await json(request(`/api/operator/roadmap/${c.itemId}/withdraw`,'POST',{}));expect((await request(`/api/public/roadmap/${p.public_slug}`)).status).toBe(404)
 expect((await env.DB.prepare("SELECT COUNT(*) count FROM notification_events WHERE roadmap_update_version_id IN (SELECT id FROM roadmap_update_versions WHERE roadmap_item_id=?)").bind(c.itemId).first<any>()).count).toBe(0)
})

it('[ROAD-012] populated upgrade preserves previous cells and a repeated migration is a no-op',async()=>{
 await reset();const migrations=inject('migrations'),prior=migrations.filter(m=>m.name<'0076')
 await applyD1Migrations(env.DB,prior);await seedLoop()
 await env.DB.prepare("INSERT INTO roadmap_items(id,slug,title,summary,status,target_window,created_at,updated_at) VALUES('prior-roadmap','prior-roadmap','Prior title','Prior summary','planned','Internal October deadline','2026-10-18','2026-10-18')").run()
 await env.DB.prepare("INSERT INTO roadmap_publications(id,roadmap_item_id,public_title,public_summary,approved_by_operator_id,approved_at,public_slug,board_id,created_at,updated_at) VALUES('prior-approval','prior-roadmap','Approved title','Approved summary','loop-operator','2026-10-18','prior-public-roadmap','loop-board','2026-10-18','2026-10-18')").run()
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name").all<{name:string}>()).results
 const read=()=>env.DB.batch<Record<string,unknown>>(tables.map(t=>env.DB.prepare(`SELECT * FROM "${t.name}" ORDER BY rowid`)))
 const before=(await read()).map(r=>r.results)
 await applyD1Migrations(env.DB,migrations)
 const after=(await read()).map((r,index)=>r.results.map(row=>Object.fromEntries(Object.keys(before[index][0]??row).map(key=>[key,row[key]]))))
 expect(after).toEqual(before)
 const complete=(await read()).map(r=>r.results);await applyD1Migrations(env.DB,migrations);expect((await read()).map(r=>r.results)).toEqual(complete)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
