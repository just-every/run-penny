import { applyD1Migrations,type D1Migration } from 'cloudflare:test'
import { inject,it,expect } from 'vitest'
import { env,createUlid } from './requester-board-fixture'
import { projectContributions } from '../../../src/core/features/requests/contributions'
export function upgradeRegression(start:5|7){it(`[REQ-006 REQ-009] 000${start} transition distinguishes a removed source vote from genuine overlap without rewriting history`,async()=>{
 const migrations=inject('migrations') as D1Migration[],db=env.DB,t0='2026-10-01T00:00:00.000Z',t1='2026-10-01T01:00:00.000Z',t2='2026-10-01T02:00:00.000Z'
 await applyD1Migrations(db,migrations.filter(m=>m.name<'0006'))
 const board=createUlid(),operator=createUlid(),who=createUlid(),cases: {a:string;b:string;merge:string;kind:string}[]=[]
 await db.batch([
  db.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES(?,?,'Upgrade board','public',0,?,?)").bind(board,`board-${board}`,t0,t0),
  db.prepare("INSERT INTO operators(id,email,display_name,created_at,updated_at) VALUES(?,'upgrade@example.test','Operator',?,?)").bind(operator,t0,t0),
  db.prepare("INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,'Voter',?,?)").bind(who,t0,t0),
 ])
 for(const kind of ['removed-revoted','removed-revoted-overlap','unchanged-transfer','overlap']){
  const a=createUlid(),b=createUlid(),merge=createUlid();cases.push({a,b,merge,kind})
  await db.batch([
   ...[a,b].map(id=>db.prepare("INSERT INTO requests(id,slug,board_id,title,description,moderation_state,public_state,public_title,public_description,published_at,created_at,updated_at) VALUES(?,?,?,'Private wording','Private description','approved','open','Public title','Public description',?,?,?)").bind(id,`prior-${id}`,board,t0,t0,t0)),
   db.prepare('UPDATE requests SET merged_into_request_id=?,merged_at=? WHERE id=?').bind(b,t1,a),
   db.prepare('INSERT INTO request_merges(id,source_request_id,target_request_id,actor_operator_id,merged_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(merge,a,b,operator,t1,t1,t1),
   db.prepare('INSERT INTO request_merge_vote_transfers(merge_id,requester_id,target_had_vote,source_created_at,source_updated_at,created_at) VALUES(?,?,?,?,?,?)').bind(merge,who,kind.includes('overlap')?1:0,t0,t0,t1),
   db.prepare('INSERT INTO request_votes(request_id,requester_id,created_at,updated_at) VALUES(?,?,?,?)').bind(b,who,kind.startsWith('removed')?t2:t0,kind.startsWith('removed')?t2:t0),
  ])
 }
 let legacyUpload:string|undefined
 if(start===7){
  await applyD1Migrations(db,migrations.filter(m=>m.name>='0006'&&m.name<'0008'))
  const retained=cases.find(c=>c.kind==='unchanged-transfer')!
  await db.batch([db.prepare('INSERT INTO request_vote_contributions(request_id,requester_id,created_at,updated_at) VALUES(?,?,?,?)').bind(retained.b,who,t2,t2),...projectContributions({binding:db},[retained.b])])
  retained.kind='native-overlap'
  legacyUpload=createUlid()
  await db.prepare("INSERT INTO request_attachment_uploads(id,request_id,storage_key,original_filename,content_type,byte_size,sha256,created_at,updated_at) VALUES(?,?,?,'original.txt','text/plain',1,'hash',?,?)").bind(legacyUpload,retained.a,`legacy/${legacyUpload}`,t0,t0).run()
 }
 const snapshots=await db.batch(['requests','request_votes','request_merges','request_merge_vote_transfers'].map(t=>db.prepare(`SELECT * FROM ${t} ORDER BY rowid`)))
 await applyD1Migrations(db,migrations.filter(m=>m.name>=`000${start===5?6:8}`))
 if(legacyUpload)expect((await db.prepare('SELECT writing FROM request_attachment_uploads WHERE id=?').bind(legacyUpload).first<{writing:number}>())?.writing).toBe(1)
 const after=await db.batch(['requests','request_votes','request_merges','request_merge_vote_transfers'].map(t=>db.prepare(`SELECT * FROM ${t} ORDER BY rowid`)))
 expect(after.map(r=>r.results)).toEqual(snapshots.map(r=>r.results))
 for(const c of cases){
  await db.batch([db.prepare('UPDATE request_merges SET unmerged_at=? WHERE id=?').bind(t2,c.merge),db.prepare('UPDATE requests SET merged_into_request_id=NULL,merged_at=NULL WHERE id=?').bind(c.a),...projectContributions({binding:db},[c.a,c.b])])
  const actual=(await db.prepare('SELECT request_id FROM request_votes WHERE request_id IN (?,?) ORDER BY request_id').bind(c.a,c.b).all<{request_id:string}>()).results.map(r=>r.request_id)
  expect(actual).toEqual((c.kind.startsWith('removed')?[c.b]:c.kind==='unchanged-transfer'?[c.a]:[c.a,c.b]).sort())
 }
 expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
}
