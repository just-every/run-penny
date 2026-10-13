import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeAll,expect,inject,it } from 'vitest'
import { exportArchive,restoreArchive,planErasure,eraseEntity } from '../../../src/core/features/data/archive'
import { seedLoop,request,json,committed,publicRequest,approve,stamp,row } from './decision-loop-fixture'
beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'));await seedLoop()})
it('[DATA-001][BASE-DATA-001][DEC-004][ROAD-007] round-trips populated comparison, mapping history, evidence links and update draft tables',async()=>{
 const c=await committed(),r=await publicRequest();await approve(c.itemId,[r.id]);await json(request(`/api/operator/roadmap/${c.itemId}/move`,'POST',{status:'in_progress',reason:'Progress for customers',idempotencyKey:crypto.randomUUID()}));await json(request(`/api/operator/roadmap/${c.itemId}/approve`,'POST',{publicTitle:'Approved title again',publicSummary:'Approved problem',boardSlug:'loop-board',requestIds:[r.id]}))
 await env.DB.prepare('INSERT INTO roadmap_evidence_links(roadmap_item_id,evidence_id,created_at,updated_at) VALUES(?,?,?,?)').bind(c.itemId,c.e.id,stamp,stamp).run()
 const snapshot=await exportArchive(env.DB,env.FILES),tables=['decision_bet_snapshots','roadmap_mapping_history','roadmap_evidence_links','roadmap_update_versions','roadmap_update_targets'];for(const table of tables)expect(snapshot.archive.tables[table].length,table).toBeGreaterThan(0)
 // Empty portable rows without deleting the installation's native and preview revision witnesses.
 const names=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'data_%' AND name NOT LIKE 'oa_%' AND name NOT IN ('d1_migrations','feedback_import_native_revision','feedback_import_preview_revision')").all<{name:string}>()).results.map(r=>r.name)
 await env.DB.batch([env.DB.prepare("UPDATE data_state SET phase='applying',lock_id=NULL WHERE singleton=1"),env.DB.prepare('PRAGMA defer_foreign_keys=ON'),...names.map(name=>env.DB.prepare(`DELETE FROM "${name}"`)),env.DB.prepare("UPDATE data_state SET phase='idle' WHERE singleton=1")])
 expect((await restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal)).status).toBe('complete')
 const restored=await exportArchive(env.DB,env.FILES);for(const table of tables)expect(restored.archive.tables[table],table).toEqual(snapshot.archive.tables[table]);expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
it('[DATA-003][EVID-002][DEC-004] erasure wins over evidence comparison snapshots and preserves independently approved public wording',async()=>{
 // Restored credentials are revoked; direct fixture re-establishes this test operator.
 await env.DB.prepare("DELETE FROM operator_sessions WHERE id='loop-session'").run();await seedLoop()
 const c=await committed(),r=await publicRequest();await approve(c.itemId,[r.id]);const person='erased-loop-person',speaker='Named speaker unique personal context'
 await env.DB.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,?,?,?)').bind(person,'Unique erased identity',stamp,stamp).run()
 await env.DB.prepare('UPDATE evidence_items SET requester_id=?,named_speaker=? WHERE id=?').bind(person,speaker,c.e.id).run()
 const plan=await planErasure(env.DB,'requesters',person);expect(plan.blockedCopies).toEqual([]);expect(plan.counts.decision_evidence_snapshots).toBe(1);expect(plan.counts.decision_bet_snapshots).toBe(1)
 expect((await eraseEntity(env.DB,env.FILES,'requesters',person,plan.planHash)).status).toBe('complete');expect(await row('evidence_items',c.e.id)).toBeNull();expect((await env.DB.prepare('SELECT * FROM decision_bet_snapshots WHERE decision_revision_id=? AND candidate_bet_id=?').bind(c.revisionId,c.a.id).all()).results).toEqual([])
 expect(await env.DB.prepare('SELECT public_title,public_summary FROM roadmap_publications WHERE roadmap_item_id=?').bind(c.itemId).first()).toEqual({public_title:'Safe roadmap title',public_summary:'Safe roadmap problem'})
})
