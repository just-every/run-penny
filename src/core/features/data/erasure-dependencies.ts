import {learningErasedScopes} from '../learning/erasure-scope'
import type { Row } from './archive'
import { NativeError } from '@/core/features/auth/native-tokens'

// Penny-owned extension to the existing bounded graph. Declare the personal
// history edges introduced/used by the clause work instead of relying on an
// opaque-ID substring accidentally discovering those children.
const edges = [
 ['penny_survey_sources','job_id','penny_survey_jobs'],
 ['penny_survey_jobs','evidence_id','evidence_items'],
 ['penny_survey_sources','evidence_id','evidence_items'],
 ['penny_survey_jobs','form_id','penny_survey_forms'],
 ['penny_discord_sources','job_id','penny_discord_jobs'],
 ['penny_discord_jobs','evidence_id','evidence_items'],
 ['penny_discord_sources','evidence_id','evidence_items'],
 ['penny_request_batch_items','request_id','requests'],
 ['penny_request_batch_items','batch_id','penny_request_batches'],
 ['penny_weekly_publications','version_id','release_versions'],
 ['penny_weekly_choices','requester_id','requesters'],
 ['penny_weekly_choices','address_id','requester_addresses'],
 ['penny_publication_schedules','release_id','releases'],
 ['penny_publication_schedules','roadmap_update_id','roadmap_update_versions'],
 ['release_attachments','release_id','releases'],
 ['penny_release_plan_items','roadmap_item_id','roadmap_items'],
 ['penny_roadmap_dependencies','blocker_id','roadmap_items'],
 ['penny_roadmap_dependencies','dependent_id','roadmap_items'],
 ['penny_feature_requests','request_id','requests'],
 ['penny_feature_roadmap','roadmap_item_id','roadmap_items'],
 ['penny_merge_notices','merge_id','request_merges'],
 ['penny_merge_notice_recipients','requester_id','requesters'],
 ['penny_merge_notice_recipients','address_id','requester_addresses'],
 ['penny_triage_status_clock','request_id','requests'],
 ['penny_evidence_snoozes','evidence_id','evidence_items'],
 ['penny_triage_reminders','request_id','requests'],
 ['penny_triage_reminders','evidence_id','evidence_items'],
 ['penny_triage_reminders','comment_id','request_comments'],
 ['penny_note_mentions','note_id','request_notes'],
 ['request_notes','parent_note_id','request_notes'],
 ['penny_board_owners','board_id','boards'],
 ['penny_request_owners','request_id','requests'],
 ['penny_evidence_owners','evidence_id','evidence_items'],
 ['penny_comment_receipts','comment_id','request_comments'],
 ['learning_observations','requester_id','requesters'],
 ['learning_observations','account_id','accounts'],
 ['learning_observations','evidence_id','evidence_items'],
 ['learning_observations','request_id','requests'],
 ['learning_contributions','observation_id','learning_observations'],
 ['learning_contributions','artifact_id','learning_artifacts'],
 ['learning_commitments','artifact_id','learning_artifacts'],
 ['learning_corrections','artifact_id','learning_artifacts'],
 ['learning_source_people','observation_id','learning_observations'],
 ['requester_identity_merges', 'source_requester_id', 'requesters'],
 ['requester_identity_merges', 'target_requester_id', 'requesters'],
 ['requester_addresses', 'requester_id', 'requesters'],
 ['release_recipient_snapshots', 'requester_id', 'requesters'],
 ['release_recipient_snapshots', 'requester_address_id', 'requester_addresses'],
 ['evidence_items', 'account_id', 'accounts'],
 ['evidence_items', 'requester_id', 'requesters'],
 ['evidence_items', 'release_id', 'releases'],
 ['evidence_versions', 'evidence_id', 'evidence_items'],
 ['attachments', 'evidence_id', 'evidence_items'],
 ['evidence_attachment_uploads', 'evidence_id', 'evidence_items'],
 ['release_outcomes', 'requester_id', 'requesters'],
 ['release_outcomes', 'release_version_id', 'release_versions'],
 ['requester_update_permissions', 'requester_id', 'requesters'],
 ['requester_update_permissions', 'requester_address_id', 'requester_addresses'],
 ['decision_reviews', 'decision_id', 'decisions'],
 ['decision_reviews', 'decision_revision_id', 'decision_revisions'],
 ['decision_review_notifications', 'decision_id', 'decisions'],
 ['release_versions', 'original_publication_version_id', 'release_versions'],
] as const

export function checkClauseErasureEdges(tables:{name:string;foreignKeys:{table:string;from:string;to:string}[]}[]):void {
 // Operator attribution is retained under the existing operator hold. Every
 // other FK on these newly introduced history tables must have a declared edge.
 for(const table of tables.filter(table=>['requester_identity_merges','evidence_attachment_uploads','decision_reviews','decision_review_notifications'].includes(table.name))){
  for(const key of table.foreignKeys)if(key.table!=='operators'&&!edges.some(([child,column,parent])=>child===table.name&&column===key.from&&parent===key.table&&key.to==='id'))throw new NativeError('undeclared_erasure_dependency',503)
 }
}

export function expandClauseErasure(data:Record<string,Row[]>,selected:Record<string,Row[]>):boolean {
 let changed=false
 const emails=new Set((selected.requester_addresses??[]).map(row=>row.email))
 for(const job of data.penny_survey_jobs??[]){
  if(!job.selected_json||selected.penny_survey_jobs.includes(job))continue
  try{
   const value=JSON.parse(String(job.selected_json))
   if(value.email&&emails.has(value.email)){selected.penny_survey_jobs.push(job);changed=true}
  }catch{throw new NativeError('survey_archive_invalid',409)}
 }
 const learningScopes=learningErasedScopes(data,selected)
 for(const artifact of data.learning_artifacts??[])if(learningScopes.has(artifact.investigation_id)&&!selected.learning_artifacts.includes(artifact)){selected.learning_artifacts.push(artifact);changed=true}
 for(const contribution of selected.learning_contributions??[]){
  const artifact=data.learning_artifacts?.find(row=>row.id===contribution.artifact_id)
  if(artifact&&!selected.learning_artifacts.includes(artifact)){selected.learning_artifacts.push(artifact);changed=true}
 }
 // Merging transfers current addresses but retains immutable history under the
 // predecessor's identity. A survivor owns that incoming lineage, including
 // every earlier merge, so its erasure must fence those roots as well. Walking
 // only backwards keeps an attempt to erase a retired source from silently
 // expanding into its active survivor; existing copy/authority holds still apply.
 for(const merge of data.requester_identity_merges??[]){
  if(!selected.requesters?.some(row=>row.id===merge.target_requester_id))continue
  const source=data.requesters.find(row=>row.id===merge.source_requester_id)
  if(source&&!selected.requesters.includes(source)){selected.requesters.push(source);changed=true}
 }
 for(const [child,column,parent] of edges){
  const parents=new Set((selected[parent]??[]).map(row=>row.id))
  for(const row of data[child]??[])if(row[column]!==null&&parents.has(row[column])&&!selected[child].includes(row)){
   selected[child].push(row);changed=true
  }
 }
 // Outcomes own an exact recipient and release-level target, not each personal
 // request mapping. If either owning record really is erased, erase all answer
 // revisions too; retaining an independent target or recipient leaves them intact.
 for(const outcome of data.release_outcomes??[]){
  const recipientErased=selected.release_recipient_snapshots.some(row=>row.release_version_id===outcome.release_version_id&&row.requester_id===outcome.requester_id)
  const version=data.release_versions.find(row=>row.id===outcome.release_version_id)
  const targetErased=selected.release_targets.some(row=>row.release_id===version?.release_id&&row.roadmap_item_id===outcome.roadmap_item_id)
  if((recipientErased||targetErased)&&!selected.release_outcomes.includes(outcome)){selected.release_outcomes.push(outcome);changed=true}
 }
 return changed
}

export function erasureFiles(selected:Record<string,Row[]>):string[]{
 return [...new Set(['attachments','release_attachments','request_attachment_uploads','evidence_attachment_uploads'].flatMap(table=>(selected[table]??[]).map(row=>String(row.storage_key))))].sort()
}

export function clauseDeletionOrder<T extends {name:string;foreignKeys:{table:string;on_delete?:string}[]}>(tables:T[]):T[]{
 const ordered:T[]=[],visited=new Set<string>()
 const witnesses=new Set(['ik_d1_custody_states','ik_d1_stream_origins'])
 const visit=(table:T)=>{
  if(visited.has(table.name))return
  visited.add(table.name)
  for(const child of tables)if(!witnesses.has(child.name)&&child.name!==table.name&&(
   edges.some(([name,,parent])=>name===child.name&&parent===table.name)||
   child.foreignKeys.some(key=>key.table===table.name&&key.on_delete==='CASCADE')
  ))visit(child)
  ordered.push(table)
 }
 // Base import custody requires these witnesses to outlive their owning job.
 for(const table of tables.filter(table=>!witnesses.has(table.name)))visit(table)
 for(const table of tables.filter(table=>witnesses.has(table.name)))visit(table)
 return ordered
}
