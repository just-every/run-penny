import {importRoadmapSchema} from './status-roadmap-policy'
import {canonicalJson,sha256} from '../../../../base/modules/import-kit/src/d1/index'
import type {SourceRecord} from '../../../../base/modules/import-kit/src/types'
import type {FeedbackSource} from './types'
import {NativeError} from '../auth/native-tokens'
import {asObject,stableFeedbackId} from './mapping-support'

export const roadmapSnapshot="json_array(source,board_slugs_json,columns_json,shipped_days,updated_at)"
export async function importRoadmapRecord(source:FeedbackSource,db:D1Database):Promise<SourceRecord|undefined>{
 if(!source.options.roadmap)return undefined
 const parsed=importRoadmapSchema.safeParse(source.options.roadmap)
 if(!parsed.success)throw new NativeError('Invalid status-roadmap mapping.',422)
 const choice=parsed.data,boards=choice.boardIds.map(id=>source.records.find(record=>record.kind==='boards'&&record.sourceId===id))
 if(boards.some(board=>!board||asObject(board.payload).isPrivate!==false))throw new NativeError('The status roadmap must select supplied public boards.',422)
 const id=stableFeedbackId(source.options.namespace,'roadmap','status-roadmap')
 const prior=await db.prepare('SELECT before_json FROM penny_import_roadmaps WHERE id=?').bind(id).first<{before_json:string}>()
 const before=prior?.before_json??await db.prepare(`SELECT ${roadmapSnapshot} snapshot FROM penny_status_roadmap_settings WHERE singleton=1`).first<string>('snapshot')
 if(!before)throw new NativeError('roadmap_settings_unavailable',503)
 const anchor=boards[0]!,created=String(asObject(anchor.payload).created)
 const after=JSON.stringify(['request_statuses',JSON.stringify(choice.boardIds.map(board=>'import-'+stableFeedbackId(source.options.namespace,'boards',board).toLowerCase())),JSON.stringify(choice.columns),choice.shippedDays,created])
 const payload={id:'status-roadmap',before,after,created}
 return {...anchor,kind:'roadmap',sourceId:'status-roadmap',payload,payloadHash:sha256(canonicalJson(payload)),location:{...anchor.location,pointer:'penny:generated:roadmap'}}
}
/** Both ordinary and streamed reversal check the live projection before deleting
 * any board. The DELETE trigger repeats this guard in the business transaction. */
export function roadmapCustodyCheck(table:string,parent:(column:string)=>string):string|undefined{
 if(table==='penny_import_roadmaps')return `EXISTS(SELECT 1 FROM penny_status_roadmap_settings WHERE singleton=1 AND ${roadmapSnapshot}=${parent('after_json')})`
 return undefined
}
