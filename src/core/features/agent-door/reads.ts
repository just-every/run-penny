import { z } from 'zod'
import type { PennyRuntime } from '@/core/app/runtime'
import { tool,id } from './tool'
import { ToolRefusal } from '../../../../base/modules/agent-door/errors.ts'
import { validateListSearch } from '../workspace/list-query'
import { pagedList } from '../workspace/paged-service'
import { searchRecords } from '../workspace/search-repository'
import { workspaceReadService } from '../workspace/service'
import { requestContext } from '../requests/operator-context'
import { EvidenceReadRepository } from '../evidence/read-repository'
import { readHierarchy } from '../hierarchy/repository'
import { readPlanning } from '../planning/repository'
import {requestSuggestions} from '../requests/suggestions'
import { listViews } from '../prioritisation/repository'

const query=z.object({q:z.string().max(200).optional(),entity:z.enum(['requests','evidence','decisions','roadmap','releases','accounts','requesters']).optional(),page:z.number().int().min(1).max(10000).optional(),sort:z.enum(['name','recent','age','votes','observed']).optional(),board:id.optional(),status:id.optional(),tag:id.optional(),account:id.optional(),moderation:z.enum(['awaiting_review','approved','rejected']).optional(),unreviewed:z.boolean().optional(),attention:z.boolean().optional(),active:z.boolean().optional()})
export const witnessTables=['boards','requests','evidence_items','evidence_versions','request_evidence_links','candidate_bets','candidate_bet_evidence_links','decisions','decision_revisions','decision_reviews','roadmap_items','roadmap_publications','roadmap_request_mappings','roadmap_transitions','roadmap_update_versions','releases','release_versions','release_targets','release_recipient_snapshots','requesters','requester_addresses','request_votes','penny_proxy_votes','request_notes','request_comments','tags','request_tag_assignments','evidence_tag_assignments','penny_products','penny_components','penny_features','penny_feature_requests','penny_feature_roadmap','penny_priority_views','penny_release_plans','penny_release_plan_items','penny_roadmap_dependencies','penny_request_batches','notification_events','notification_intents','notification_batches','notification_outbox','notification_attempts','notification_outbox_attempts','penny_publication_schedules','learning_sources','learning_investigations','learning_runs','penny_ai_runs','penny_request_batch_items','penny_request_owners','penny_evidence_owners','penny_board_owners','penny_evidence_snoozes','penny_note_mentions','requester_identity_merges','penny_workspace_clock','learning_artifacts','learning_contributions','learning_observations','learning_corrections','learning_invalidations']
/** An effect witness exposes stable row identities and content digests only.
 * Delivery payloads, contact addresses and retained private copies never leave. */
export async function nativeSnapshot(db:D1Database,actor:string){
 const rows=await db.batch(witnessTables.map(t=>t==='penny_priority_views'?db.prepare('SELECT * FROM penny_priority_views WHERE owner_id=? OR shared=1').bind(actor):db.prepare(`SELECT * FROM ${t}`)))
 const digest=async(value:unknown)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(byte=>byte.toString(16).padStart(2,'0')).join('')
 return Object.fromEntries(await Promise.all(witnessTables.map(async(t,i)=>[t,(await Promise.all(rows[i].results.map(async row=>({digest:await digest(row)})))).sort((a,b)=>a.digest.localeCompare(b.digest))])))
}

export function readTools(runtime:PennyRuntime){return [
 tool(runtime,{name:'duplicates.suggest',title:'Read lexical native duplicate suggestions',scope:'feedback:read',readOnly:true,clauses:['EVID-007','AI-001'],schema:z.object({title:z.string().min(1).max(280)}),run:async(a,n)=>({items:await requestSuggestions(n.db,a.title,true)})}),
 tool(runtime,{name:'search.records',title:'Search the native feedback queue',scope:'feedback:read',readOnly:true,clauses:['OPS-004','REQ-028','OPS-006'],schema:query,run:async(a,n)=>a.entity?pagedList(n.database,a.entity,validateListSearch(a)):searchRecords(n.database,validateListSearch(a))}),
 tool(runtime,{name:'requests.get',title:'Read a request and its native context',scope:'requests:inspect',readOnly:true,clauses:['REQ-026','REQ-035','SEG-007','REQ-016'],schema:z.object({slug:id}),run:async(a,n)=>({slug:a.slug,...await requestContext(n.database,a.slug)})}),
 tool(runtime,{name:'evidence.get',title:'Read current captured evidence',scope:'feedback:read',readOnly:true,clauses:['EVID-001','EVID-002'],schema:z.object({id}),run:async(a,n)=>{const row=(await new EvidenceReadRepository(n.database).list(undefined,undefined,[a.id]))[0];if(!row)throw new ToolRefusal('not_found');return row}}),
 tool(runtime,{name:'people.get',title:'Read a customer or account context',scope:'feedback:read',readOnly:true,clauses:['OPS-007','EVID-005'],schema:z.object({kind:z.enum(['person','account']),id}),run:async(a,n)=>{
  if(a.kind==='account'){const r=await n.db.prepare('SELECT slug FROM accounts WHERE id=?').bind(a.id).first<{slug:string}>();const value=r?await workspaceReadService(n.database).findAccount(r.slug):null;if(!value)throw new ToolRefusal('not_found');return value}
  const r=await n.db.prepare('SELECT id,display_name AS name,blocked_at AS blockedAt FROM requesters WHERE id=?').bind(a.id).first();if(!r)throw new ToolRefusal('not_found');return {...r,requests:(await n.db.prepare('SELECT id,slug,title,public_state FROM requests WHERE author_requester_id=? ORDER BY id LIMIT 100').bind(a.id).all()).results,votes:(await n.db.prepare('SELECT request_id FROM request_votes WHERE requester_id=? ORDER BY request_id LIMIT 100').bind(a.id).all()).results}
 }}),
 tool(runtime,{name:'overview.get',title:'Read the operator overview',scope:'feedback:read',readOnly:true,clauses:['OPS-003','MEAS-004','MEAS-005','MEAS-006','CAP-016','DELIV-008','TRIAGE-002'],schema:z.object({}),run:async(_a,n)=>({...await workspaceReadService(n.database).getOverview({},new Date().toISOString().slice(0,10)),actorId:n.actor})}),
 tool(runtime,{name:'audit.list',title:'Read native activity with preparer and approvers',scope:'feedback:read',readOnly:true,clauses:['ROLE-004'],schema:z.object({entity:id.optional(),id:id.optional(),limit:z.number().int().min(1).max(100).default(25)}),run:async(a,n)=>({items:(await n.db.prepare(`SELECT id,action,entity_type,entity_id,occurred_at,details_json FROM audit_entries WHERE (? IS NULL OR entity_type=?) AND (? IS NULL OR entity_id=?) ORDER BY occurred_at DESC,id DESC LIMIT ?`).bind(a.entity??null,a.entity??null,a.id??null,a.id??null,a.limit).all()).results})}),
 tool(runtime,{name:'workspace.snapshot',title:'Inspect native feedback effects without running work',scope:'feedback:read',readOnly:true,clauses:['SURFACE-007'],schema:z.object({}),run:async(_a,n)=>nativeSnapshot(n.db,n.actor)}),
 tool(runtime,{name:'hierarchy.get',title:'Read products, components and features',scope:'feedback:read',readOnly:true,clauses:['PRIO-001'],schema:z.object({}),run:async(_a,n)=>readHierarchy(n.db)}),
 tool(runtime,{name:'planning.get',title:'Read release plans and dependencies',scope:'feedback:read',readOnly:true,clauses:['ROAD-009','ROAD-011'],schema:z.object({}),run:async(_a,n)=>readPlanning(n.db,new Date().toISOString().slice(0,10))}),
 tool(runtime,{name:'views.list',title:'Read native prioritisation views',scope:'feedback:read',readOnly:true,clauses:['OPS-006','PRIO-003','ROAD-009'],schema:z.object({}),run:async(_a,n)=>({items:await listViews(n.db,n.actor)})}),
]}
