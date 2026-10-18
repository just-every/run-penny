import {z} from 'zod'
import {canonicalJson,sha256} from '../../../../base/modules/import-kit/src/d1/index'
import type {SourceRecord} from '../../../../base/modules/import-kit/src/types'
import {NativeError} from '../auth/native-tokens'
import {asObject,sourceTime} from './mapping-support'
import type {SavedFeedbackInput} from './types'

export const internalStatusMappings=z.record(z.string().min(1).max(100),z.object({name:z.string().trim().min(1).max(160),showPublicLabel:z.boolean()}).strict())
export function sourceStatus(record:SourceRecord){
 const p=asObject(record.payload)
 return p._format==='ideas-csv'?asObject(p._idea).status:p.status??p['Post Status']
}
/** Definitions have independent custody: erasing one post must not erase a
 * status shared by other posts. Generated records retain their source anchor. */
export function internalStatusRecords(input:SavedFeedbackInput,records:SourceRecord[]):SourceRecord[]{
 if(!input.internalStatuses)return []
 const mappings=internalStatusMappings.safeParse(input.internalStatuses)
 if(!mappings.success)throw new NativeError('Invalid internal status mappings.',422)
 return Object.entries(mappings.data).map(([status,definition],position)=>{
  if(!Object.hasOwn(input.statuses,status))throw new NativeError('Each internal status needs a reviewed public mapping.',422)
  const post=records.find(record=>record.kind==='posts'&&sourceStatus(record)===status)
  if(!post)throw new NativeError('Internal status must name a status in the supplied Canny posts.',422)
  const p=asObject(post.payload),created=sourceTime(p._format==='ideas-csv'?asObject(p._idea).created:p.created??p['Date created'])
  const payload={id:status,...definition,publicStatus:input.statuses[status],position,created}
  return {...post,kind:'statuses',sourceId:status,payload,payloadHash:sha256(canonicalJson(payload)),location:{...post.location,pointer:'penny:generated:status:'+status}}
 })
}
