import { z } from 'zod'
import type { DatabaseConnection } from '@/core/platform/database'
import { contributionScope } from './contributions'
import { RequestLifecycleError } from './lifecycle-types'
export const defaultImportanceLabels=['Nice to have','Important','Must have'] as const
export const importanceValue=z.number().int().min(1).max(4).nullable()
export const importanceInput=z.object({importance:importanceValue}).strict()
export interface ImportanceSettings {enabled:boolean;labels:readonly string[]}
export async function boardImportance(db:D1Database,boardId:string):Promise<ImportanceSettings>{
 const row=await db.prepare('SELECT enabled,labels_json FROM penny_vote_importance_settings WHERE board_id=?').bind(boardId).first<{enabled:number;labels_json:string}>()
 return row?{enabled:!!row.enabled,labels:JSON.parse(row.labels_json) as string[]}:{enabled:false,labels:defaultImportanceLabels}
}
export function importanceAdmission(boardId:string,value:number|null){
 return value===null?{sql:'1',values:[] as (string|number)[]}:{sql:'EXISTS(SELECT 1 FROM penny_vote_importance_settings WHERE board_id=? AND enabled=1 AND json_array_length(labels_json)>=?)',values:[boardId,value]}
}
export async function checkImportance(db:D1Database,boardId:string,value:number|null|undefined){
 if(value==null)return
 const settings=await boardImportance(db,boardId)
 if(!settings.enabled||value>settings.labels.length)throw new RequestLifecycleError(409,'vote_importance_unavailable','The board’s importance choices changed. Reload before choosing importance.')
}
export function importanceStatements(connection:DatabaseConnection,requestId:string,requesterId:string,value:number|null|undefined,now:string):D1PreparedStatement[]{
 if(value===undefined)return []
 const db=connection.binding
 return [db.prepare(`DELETE FROM penny_vote_importance WHERE request_id IN (${contributionScope}) AND requester_id=?`).bind(requestId,requesterId),
  db.prepare(`INSERT INTO penny_vote_importance(request_id,requester_id,importance,created_at,updated_at) SELECT request_id,requester_id,?,?,? FROM request_vote_contributions WHERE request_id IN (${contributionScope}) AND requester_id=?`).bind(value,now,now,requestId,requesterId)]
}
/** A merged vote is one person; their latest explicit choice wins deterministically. */
export const voteImportanceSql=(request='v.request_id',person='v.requester_id')=>`(SELECT importance FROM penny_vote_importance importance JOIN request_canonical_roots root ON root.origin_id=importance.request_id WHERE root.canonical_id=${request} AND importance.requester_id=${person} ORDER BY importance.updated_at DESC,importance.request_id LIMIT 1)`
