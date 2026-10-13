import { canonicalJson, sha256 } from '../../../../base/modules/import-kit/src/d1/index.ts'
import type { SourceRecord } from '../../../../base/modules/import-kit/src/types.ts'
import { asObject, reference, sourceTime } from './mapping-support'

// Canny embeds a prior-post summary on the surviving post. That summary is
// relationship evidence only: the graph still requires the complete source post.
export function cannyMergeRecords(records: SourceRecord[]): SourceRecord[] {
 const merges: SourceRecord[] = []
 for (const record of records.filter(row=>row.kind==='posts')) {
  const payload=asObject(record.payload)
  if(payload._format==='ideas-csv')continue
  const history=payload.mergeHistory
  if(history===undefined)continue
  if(!Array.isArray(history))throw new Error('Invalid Canny merge history')
  for(const [index,value] of history.entries()) {
   const entry=asObject(value),from=reference(entry.post),created=sourceTime(entry.created)
   const payload={id:'canny-merge:'+from,sourcePostId:from,targetPostId:record.sourceId,created}
   merges.push({...record,kind:'merges',sourceId:payload.id,payload,payloadHash:sha256(canonicalJson(payload)),location:{...record.location,pointer:'penny:generated:'+(record.location.pointer??'')+'/mergeHistory/'+index}})
  }
 }
 return merges
}
