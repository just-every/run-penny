import {conversation} from './source'
import {publicRequestPredicate} from '../requests/publication-predicate'
import type {PennyRuntime} from '@/core/app/runtime'
import {createUlid} from '@/core/shared/ulid'
import {NativeError} from '../auth/native-tokens'
import {publicationFlags} from '../ai/drafts'
import {connectionDb,provider,type Connection} from './configuration'
import {audit} from '../decisions/write-support'
import {requestStatusExpression,requestStatusChangedAtExpression} from '../requests/status-sql'
export const publicRevisionSql=`COALESCE((SELECT id FROM request_status_updates WHERE request_id=r.id ORDER BY publication_version DESC,published_at DESC,id DESC LIMIT 1),r.published_at)||':'||${requestStatusExpression}||':'||COALESCE(${requestStatusChangedAtExpression},'')`
export const approvedSql=`SELECT r.id,r.slug,r.public_title title,${requestStatusExpression} status,
 ${publicRevisionSql} statusId
 FROM requests r JOIN boards b ON b.id=r.board_id LEFT JOIN requesters author ON author.id=r.author_requester_id WHERE b.visibility='public' AND b.archived_at IS NULL AND ${publicRequestPredicate}`
type PublicRequest={id:string;slug:string;title:string;status:string;statusId:string}
export async function prepareReplies(runtime:PennyRuntime,c:Connection,now:string,evidenceId?:string){
 const db=connectionDb(runtime,c)
 const links=(await db.prepare(`SELECT h.evidence_id,h.request_id FROM penny_helpscout_captures h JOIN requests r ON r.id=h.request_id WHERE h.connection_id=? AND h.state='done' AND h.source_state IN('current','changed') AND (? IS NULL OR h.evidence_id=?) AND NOT EXISTS(SELECT 1 FROM penny_helpscout_replies d WHERE d.evidence_id=h.evidence_id AND d.status_id=${publicRevisionSql}) ORDER BY h.updated_at,h.conversation_id LIMIT 50`).bind(c.id,evidenceId??null,evidenceId??null).all<{evidence_id:string;request_id:string}>()).results
 for(const link of links){
  const request=await db.prepare(approvedSql+' AND r.id=?').bind(link.request_id).first<PublicRequest>()
  if(!request)continue
  const text=`Update on “${request.title}”: ${request.status.replaceAll('_',' ')}. ${runtime.configuration.appOrigin}/portal/feedback/${request.slug}`
  const withheld=(await publicationFlags(db,text)).length>0
  await db.prepare("INSERT INTO penny_helpscout_replies(id,evidence_id,request_id,status_id,body,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING").bind(createUlid(),link.evidence_id,link.request_id,request.statusId,withheld?'Review public wording in Penny before replying.':text,withheld?'held':'draft',now,now).run()
 }
}
export async function sendReply(runtime:PennyRuntime,c:Connection,db:D1Database,conversationId:number,id:string,text:string){
 const row=await db.prepare(`SELECT d.*,h.customer_id,h.trigger_kind FROM penny_helpscout_replies d JOIN penny_helpscout_captures h ON h.evidence_id=d.evidence_id WHERE d.id=? AND h.connection_id=? AND h.conversation_id=? AND h.source_state IN('current','changed') AND h.state='done'`).bind(id,c.id,conversationId).first<{id:string;request_id:string;status_id:string;state:string;customer_id:number;trigger_kind:string;evidence_id:string}>()
 if(!row)throw new NativeError('helpscout_reply_unavailable',404)
 if(row.state!=='draft')throw new NativeError('helpscout_reply_already_attempted',409)
 const current=await db.prepare(approvedSql+' AND r.id=?').bind(row.request_id).first<PublicRequest>()
 if(current?.statusId!==row.status_id)throw new NativeError('helpscout_reply_stale',409)
 if((await publicationFlags(db,text)).length)throw new NativeError('helpscout_reply_private',422)
 const now=new Date().toISOString()
 const result=await db.batch([
  db.prepare("UPDATE penny_helpscout_replies SET state='sending',edited_body=?,actor_id=?,updated_at=? WHERE id=? AND state='draft' RETURNING id").bind(text,c.actor_id,now,id),
  audit(db,c.actor_id,'helpscout_reply',id,'helpscout.reply_approved',now),
 ])
 if(!result[0].results.length)throw new NativeError('helpscout_reply_already_attempted',409)
 // No retries after a possible send, even a timeout. Help Scout offers no
 // documented idempotency key for this endpoint; unknown requires reconciliation.
 try{
  const sourceResponse=await provider(runtime,c,`/conversations/${conversationId}`)
  if(sourceResponse.status!==200)throw new NativeError('helpscout_reply_source_changed',409)
  const source=conversation.parse(JSON.parse(sourceResponse.body))
  if(source.id!==conversationId||source.mailboxId!==c.mailbox_id||source.primaryCustomer.id!==row.customer_id||(row.trigger_kind==='tag'&&!source.tags.some(t=>t.tag===c.tag)))throw new NativeError('helpscout_reply_source_changed',409)
  if(!await db.prepare("SELECT 1 FROM penny_helpscout_captures WHERE evidence_id=? AND state='done' AND source_state IN('current','changed')").bind(row.evidence_id).first())throw new NativeError('helpscout_reply_source_changed',409)
  const latest=await db.prepare(approvedSql+' AND r.id=?').bind(row.request_id).first<PublicRequest>()
  if(latest?.statusId!==row.status_id||(await publicationFlags(db,text)).length)throw new NativeError('helpscout_reply_stale',409)
  const response=await provider(runtime,c,`/conversations/${conversationId}/reply`,'POST',JSON.stringify({customer:{id:row.customer_id},text:text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),user:c.sidebar_user_id,draft:false}))
  const state=response.status===201?'sent':'unknown'
  await db.batch([db.prepare('UPDATE penny_helpscout_replies SET state=?,updated_at=? WHERE id=?').bind(state,new Date().toISOString(),id),audit(db,c.actor_id,'helpscout_reply',id,'helpscout.reply_'+state,new Date().toISOString())])
  if(state!=='sent')throw new NativeError('helpscout_reply_unknown',409)
  return {sent:true}
 }catch(error){await runtime.database.binding.prepare("UPDATE penny_helpscout_replies SET state='unknown' WHERE id=? AND state='sending'").bind(id).run();if(error instanceof NativeError)throw error;throw new NativeError('helpscout_reply_unknown',409)}
}
