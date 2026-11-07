import { expect } from 'vitest'
import { call, env } from './support'
import { graph,time } from './notification-regression-fixture'
import { saveReleaseDraft } from '@/core/features/releases/drafts'
import { prepareRoadmapUpdateDraft } from '@/core/features/roadmap/update-drafts'
import type { ReleaseDraft } from '@/core/features/releases/drafts'

export async function nativeReleaseDraft(g:Awaited<ReturnType<typeof releaseGraph>>,changes:Partial<ReleaseDraft>={}){
 const response=await call('/api/operator/releases',{...g.input,...changes},g.operator)
 expect(response.status,await response.clone().text()).toBe(201)
 return response.json() as Promise<{id:string;slug:string;versionId:string}>
}
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

/** A complete native decision, approved mapping and draft for visibility journeys. */
export async function nativeReleaseTarget(operator:Record<string,string>,requestId:string,boardSlug:string,title:string){
 const post=async<T>(path:string,input:unknown,status=201):Promise<T>=>{
  const response=await call(path,input,operator)
  expect(response.status,await response.clone().text()).toBe(status)
  return response.json() as Promise<T>
 }
 const options=await call('/api/operator/releases/options',undefined,operator)
 expect(options.status).toBe(200)
 const {operators}=await options.json() as {operators:{id:string}[]}
 expect(operators).toHaveLength(1)
 const actor=operators[0].id
 const decision=await post<{id:string}>('/api/operator/decisions',{question:`Choose ${title}`,ownerOperatorId:actor})
 const betInput={summary:'A concrete improvement',urgency:'This quarter',deliveryShape:'Small release',successMeasure:'Fewer repeated steps'}
 const chosen=await post<{id:string}>(`/api/operator/decisions/${decision.id}/bets`,{...betInput,title})
 await post(`/api/operator/decisions/${decision.id}/bets`,{...betInput,title:`Alternative to ${title}`})
 const evidence=await post<{id:string}>('/api/operator/evidence',{sourceType:'interview',wording:`Observed need for ${title}`,observedAt:new Date().toISOString()})
 const linked=await call(`/api/operator/evidence/${evidence.id}/links`,{target:'bet',targetId:chosen.id,stance:'supporting'},operator,'PUT')
 expect(linked.status,await linked.clone().text()).toBe(200)
 const item=await post<{itemId:string}>(`/api/operator/decisions/${decision.id}/commit`,{selectedCandidateBetId:chosen.id,rationale:'Measured choice',ownerOperatorId:actor,confidence:'medium',reviewAt:new Date(Date.now()+7*86_400_000).toISOString().slice(0,10)},200)
 await post(`/api/operator/roadmap/${item.itemId}/approve`,{publicTitle:title,publicSummary:`Public improvement for ${title}`,boardSlug,requestIds:[requestId]},200)
 await post(`/api/operator/roadmap/${item.itemId}/move`,{status:'shipped',reason:'Delivery completed',idempotencyKey:crypto.randomUUID()},200)
 const tag=await post<{id:string}>('/api/operator/catalog/tags',{name:`Release tag for ${title}`})
 const draft=await post<{id:string;slug:string;versionId:string}>('/api/operator/releases',{title:`Release for ${title}`,body:`Released improvement for ${title}.`,releaseType:'improved',tagIds:[tag.id],publicationDate:new Date().toISOString().slice(0,10),targetIds:[item.itemId],authorOperatorId:actor})
 const publicSlug=await env.DB.prepare('SELECT public_slug FROM roadmap_publications WHERE roadmap_item_id=?').bind(item.itemId).first<string>('public_slug')
 expect(publicSlug).toBeTruthy()
 return {itemId:item.itemId,publicSlug:publicSlug!,draft}
}
