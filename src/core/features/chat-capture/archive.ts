import {NativeError} from '../auth/native-tokens'
import type {Row} from '../data/archive'
import {messageTimestamp,permalink} from './slack'
/** An archive is untrusted input, including the links shown in the inbox. */
export function validateChatArchive(data:Record<string,Row[]>){
 for(const row of data.penny_chat_sources??[]){
  try{
   if(!messageTimestamp(row.message_ts)||!messageTimestamp(row.thread_ts)||permalink(row.source_url)!==row.source_url||!['captured','changed','removed','purged'].includes(String(row.state))||!(data.evidence_items??[]).some(item=>item.id===row.evidence_id))throw Error('invalid')
   for(const field of ['workspace_id','channel_id','source_author','capturer','source_team'])if(row[field]!==null&&!/^[A-Z][A-Z0-9]{1,79}$/.test(String(row[field])))throw Error('invalid')
   if(row.state==='purged'?row.fingerprint!=='':!/^[a-f0-9]{64}$/.test(String(row.fingerprint)))throw Error('invalid')
  }catch{throw new NativeError('invalid_chat_source_archive',400)}
 }
}
