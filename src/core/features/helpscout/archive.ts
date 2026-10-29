import type {Row} from '../data/archive'
import {NativeError,digest} from '../auth/native-tokens'
/** Restored work has no credential or delegated sidebar authority. */
export async function validateHelpScoutArchive(data:Record<string,Row[]>){
 const captures=data.penny_helpscout_captures??[],evidence=new Map((data.evidence_items??[]).map(row=>[row.id,row])),receipts=new Set((data.penny_helpscout_receipts??[]).map(row=>row.source_digest)),connections=new Set((data.penny_helpscout_connection??[]).map(row=>row.id))
 for(const row of captures){
  if(!connections.has(row.connection_id)||!Number.isSafeInteger(row.conversation_id)||Number(row.conversation_id)<=0||!['tag','sidebar'].includes(String(row.trigger_kind)))throw new NativeError('helpscout_archive_invalid',409)
  if(row.evidence_id!==null&&(!evidence.has(row.evidence_id)||evidence.get(row.evidence_id)?.source_type!=='support_conversation'||!receipts.has(await digest(row.connection_id+':'+row.conversation_id))))throw new NativeError('helpscout_archive_invalid',409)
  if(row.state==='done'&&row.evidence_id===null)throw new NativeError('helpscout_archive_invalid',409)
 }
}
