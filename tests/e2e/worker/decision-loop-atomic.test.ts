import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeAll,expect,inject,it } from 'vitest'
import { seedLoop,request,json,ready,commitInput,operatorId,stamp,approve,row } from './decision-loop-fixture'

beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'));await seedLoop()})

it('[DEC-004][DEC-005] a concurrent evidence version is captured wholly before or after its atomic write',async()=>{
 const {d,a,e}=await ready(),versionId='racing-version-'+e.id
 const [commit]=await Promise.all([
  request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)),
  env.DB.prepare('INSERT INTO evidence_versions(id,evidence_id,version_number,wording,edited_by_operator_id,created_at,updated_at) VALUES(?,?,2,?,?,?,?)').bind(versionId,e.id,'Concurrent original wording',operatorId,stamp,stamp).run(),
 ])
 expect(commit.status).toBe(200)
 const result=await commit.json() as {revisionId:string}
 const captured=(await env.DB.prepare('SELECT s.evidence_version_id,v.version_number,v.wording FROM decision_evidence_snapshots s JOIN evidence_versions v ON v.id=s.evidence_version_id WHERE s.decision_revision_id=? AND s.evidence_id=?').bind(result.revisionId,e.id).all<{evidence_version_id:string;version_number:number;wording:string}>()).results
 expect(captured).toHaveLength(1)
 expect([1,2]).toContain(captured[0].version_number)
 if(captured[0].version_number===2)expect(captured[0]).toMatchObject({evidence_version_id:versionId,wording:'Concurrent original wording'})
 else expect(captured[0].wording).toBe((await env.DB.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=? AND version_number=1').bind(e.id).first<{wording:string}>())!.wording)
 await env.DB.prepare('INSERT INTO evidence_versions(id,evidence_id,version_number,wording,edited_by_operator_id,created_at,updated_at) VALUES(?,?,3,?,?,?,?)').bind('later-'+e.id,e.id,'Still later original wording',operatorId,stamp,stamp).run()
 expect((await env.DB.prepare('SELECT evidence_version_id FROM decision_evidence_snapshots WHERE decision_revision_id=? AND evidence_id=?').bind(result.revisionId,e.id).all()).results).toEqual([{evidence_version_id:captured[0].evidence_version_id}])
})

it('[DEC-005][ROAD-002] concurrent existing-item editing and commitment retain one item and the complete edit',async()=>{
 const {d,a}=await ready(),id='racing-item-'+a.id
 await env.DB.prepare("INSERT INTO roadmap_items(id,slug,decision_id,candidate_bet_id,title,summary,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'exploring',?,?)").bind(id,id,d.id,a.id,'Original item','Original summary',stamp,stamp).run()
 const results=await Promise.all([
  request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)),
  request(`/api/operator/roadmap/${id}`,'PATCH',{title:'Edited item',summary:'Edited summary',ownerOperatorId:operatorId,targetWindow:'Next quarter',deliveryNotes:'Keep complete edit',confidence:'medium',accountImpact:'One affected account',decisionId:d.id,candidateBetId:a.id,publicTitle:'Draft safe title',publicSummary:'Draft safe problem',evidenceIds:[]}),
 ])
 expect(results.map(r=>r.status)).toEqual([200,200])
 expect(await results[0].json()).toMatchObject({itemId:id})
 expect(await row('roadmap_items',id)).toMatchObject({title:'Edited item',summary:'Edited summary',status:'planned',delivery_notes:'Keep complete edit',target_window:'Next quarter'})
 expect((await env.DB.prepare('SELECT id FROM roadmap_items WHERE candidate_bet_id=?').bind(a.id).all()).results).toEqual([{id}])
 expect((await env.DB.prepare('SELECT from_status,to_status FROM roadmap_transitions WHERE roadmap_item_id=?').bind(id).all()).results).toEqual([{from_status:'exploring',to_status:'planned'}])
})

it('[DEC-005][ROAD-007] a late approved-commit failure rolls back revision, both snapshots, item, transition, draft, targets and activity',async()=>{
 const {d,a}=await ready(),id='atomic-item-'+a.id
 await env.DB.prepare("INSERT INTO roadmap_items(id,slug,decision_id,candidate_bet_id,title,summary,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'exploring',?,?)").bind(id,id,d.id,a.id,'Existing item','Existing summary',stamp,stamp).run();await approve(id)
 const tables=['decisions','decision_revisions','decision_evidence_snapshots','decision_bet_snapshots','roadmap_items','roadmap_transitions','roadmap_update_versions','roadmap_update_targets','audit_entries']
 const capture=()=>Promise.all(tables.map(async table=>(await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results))
 const before=await capture()
 await env.DB.exec("CREATE TRIGGER fail_approved_commit BEFORE INSERT ON audit_entries WHEN NEW.action='decision.committed' BEGIN SELECT RAISE(ABORT,'late approved commit failure'); END")
 try{expect((await request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id))).status).toBe(503)}finally{await env.DB.exec('DROP TRIGGER fail_approved_commit')}
 expect(await capture()).toEqual(before)
 await json(request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)))
})

it('[DEC-005][BASE-OPS-002] restored historical duplicate item associations are preserved and require explicit resolution before commitment',async()=>{
 const {d,a}=await ready()
 await env.DB.batch([env.DB.prepare("UPDATE data_state SET phase='applying' WHERE singleton=1"),...['legacy-first','legacy-second'].map(prefix=>env.DB.prepare("INSERT INTO roadmap_items(id,slug,decision_id,candidate_bet_id,title,summary,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'exploring',?,?)").bind(prefix+a.id,prefix+a.id,d.id,a.id,prefix,'Preserved historical item',stamp,stamp)),env.DB.prepare("UPDATE data_state SET phase='idle' WHERE singleton=1")])
 const before=(await env.DB.prepare('SELECT * FROM roadmap_items WHERE candidate_bet_id=? ORDER BY id').bind(a.id).all()).results
 const response=await request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id))
 expect(response.status).toBe(409);expect(await response.text()).toContain('multiple historical roadmap items')
 expect((await env.DB.prepare('SELECT * FROM roadmap_items WHERE candidate_bet_id=? ORDER BY id').bind(a.id).all()).results).toEqual(before)
 expect((await env.DB.prepare('SELECT * FROM decision_revisions WHERE decision_id=?').bind(d.id).all()).results).toEqual([])
 await env.DB.prepare('UPDATE roadmap_items SET candidate_bet_id=NULL WHERE id=?').bind('legacy-second'+a.id).run()
 expect(await json(request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)))).toMatchObject({itemId:'legacy-first'+a.id})
})
