import { expect } from 'vitest'
import { env } from './support'
import { graph,time } from './notification-regression-fixture'
import { saveReleaseDraft } from '@/core/features/releases/drafts'
import { prepareRoadmapUpdateDraft } from '@/core/features/roadmap/update-drafts'
export async function releaseGraph(count=2,otherAuthor=false,existing?:Awaited<ReturnType<typeof graph>>){
 const g=existing??await graph(count,otherAuthor),db=env.DB,actor=(await db.prepare('SELECT id FROM operators').first<{id:string}>())!.id
 await db.batch([
  db.prepare("INSERT INTO tags(id,name,created_at,updated_at) VALUES('release-tag','Workflow',?,?)").bind(time(),time()),
  db.prepare("INSERT INTO decisions(id,slug,title,question,state,rationale,created_at,updated_at) VALUES('release-decision','private-decision-slug','Private decision marker','Private question','committed','Private commercial rationale',?,?)").bind(time(),time()),
  db.prepare("INSERT INTO roadmap_items(id,slug,decision_id,title,summary,status,delivery_notes,created_at,updated_at) VALUES('release-item','private-item-slug','release-decision','Private item title','Private item summary','shipped','Private delivery notes',?,?)").bind(time(),time()),
  db.prepare("INSERT INTO roadmap_publications(id,roadmap_item_id,public_title,public_summary,public_slug,approved_by_operator_id,approved_at,created_at,updated_at) VALUES('release-approval','release-item','Approved improvement','Approved problem','safe-roadmap-token',?,?,?,?)").bind(actor,time(),time(),time()),
  ...g.requests.map(r=>db.prepare("INSERT INTO roadmap_request_mappings(roadmap_item_id,request_id,approved_at,created_at,updated_at) VALUES('release-item',?,?,?,?)").bind(r.id,time(),time(),time())),
 ])
 const input={title:'Workflow improvement',body:'Customer-safe release details.',releaseType:'improved' as const,tagIds:['release-tag'],publicationDate:'2026-10-08',setupUrl:'https://example.test/help',targetIds:['release-item'],authorOperatorId:actor}
 const draft=await saveReleaseDraft(db,input,undefined,time())
 const transition=async(status:'planned'|'in_progress'|'shipped'|'dropped',id=crypto.randomUUID())=>{
  const publicStatus=status==='dropped'?'withdrawn':status
  await db.batch([
   db.prepare('UPDATE roadmap_items SET status=?,updated_at=? WHERE id=?').bind(status,time(),'release-item'),
   db.prepare("INSERT INTO roadmap_transitions(id,roadmap_item_id,to_status,reason,actor_operator_id,created_at,updated_at) VALUES(?,'release-item',?,'Private transition rationale',?,?,?)").bind(id,status,actor,time(),time()),
   ...prepareRoadmapUpdateDraft(db,{itemId:'release-item',transitionId:id,actorId:actor,now:time(),publicStatus}),
  ])
  expect(await db.prepare('SELECT id FROM roadmap_update_versions WHERE transition_id=?').bind(id).first()).not.toBeNull()
  return id
 }
 return {...g,actor,input,draft,transition}
}
