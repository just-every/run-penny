import type { Json, SourceBundle } from '../../../../base/modules/import-kit/src/types.ts'
export type FeedbackKind = 'boards' | 'users' | 'posts' | 'votes' | 'comments' | 'tags' | 'merges'
export type FeedbackStatus = 'open' | 'under_review' | 'planned' | 'in_progress' | 'shipped' | 'declined'
/** Headings are explicitly supplied by the operator. Canny documents Ideas
 * categories, not a stable CSV schema or a guaranteed identifier column. */
export interface IdeasColumns {
 key:string; title:string; details:string; status:string; created:string
 author?:string
 aggregates?:Record<string,'count'|'company'|'revenue'>
 omissions?:string[]
}
/** UserVoice documents its export columns by name, so headings are known. The
 * owner still declares the export's scope and every choice Penny cannot read. */
export interface UserVoiceOptions {
 /** Required: an undeclared scope is refused before anything is read. */
 scope?:'complete'|'filtered'
 filter?:string
 headings?:Record<string,string>
 forums?:Record<string,string>
 omissions?:string[]
}
export type UserVoiceVersion='uservoice-ideas-csv'|'uservoice-voters-csv'
export interface SavedFeedbackInput {
 /** Settings copied by the owner from each source board; keyed by source board ID. */
 boardPolicies?:Record<string,import('./board-policy').FeedbackBoardPolicy>
 namespace: string
 files: { name: string; kind: FeedbackKind; version: 'v1' | 'v2' | 'classic-csv' | 'ideas-csv' | UserVoiceVersion | 'relationships-v1'; base64: string; boardId?: string; tagMapping?: Record<string, string[]>; ideas?:IdeasColumns; uservoice?:UserVoiceOptions }[]
 statuses: Record<string, FeedbackStatus>
 boards?: { id: string; name: string; isPrivate: boolean; created: string }[]
}
export interface FeedbackSource extends SourceBundle { options: SavedFeedbackInput }
export interface NativeImportValue { rows: { table: string; values: Record<string, Json> }[]; provenance:{sourceId:string;artifactHash:string;payloadHash:string} }
export const feedbackKinds: FeedbackKind[] = ['boards','users','posts','votes','comments','tags','merges']
export const importBounds = { bytes: 4 * 1024 * 1024, sourceBytes:24 * 1024 * 1024, records: 50000, recordBytes: 128 * 1024, planBytes: 24 * 1024 * 1024 }
