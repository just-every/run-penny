import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError,digest} from '../auth/native-tokens'
import {createOperatorRequest} from '../requests/operator-context'
import {recordProxyVote} from '../requests/proxy-votes'
import {redactCaptured,redactionFence} from '../redaction/settings'
import {audit} from '../decisions/write-support'
import {connectionDb,activeConnection,sourceUrl} from './configuration'
import {enqueue,type Capture} from './work'
import {approvedSql,publicRevisionSql,prepareReplies,sendReply} from './replies'
const id=z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/)
export const actionInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('view')}).strict(),z.object({action:z.literal('capture')}).strict(),z.object({action:z.literal('search'),query:z.string().max(200)}).strict(),
 z.object({action:z.literal('link'),requestId:id}).strict(),
 z.object({action:z.literal('create'),title:z.string().trim().min(1).max(280),description:z.string().trim().min(1).max(20000),boardSlug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128)}).strict(),
 z.object({action:z.literal('vote'),reviewed:z.literal(true),source:z.string().trim().min(1).max(2000)}).strict(),
 z.object({action:z.literal('send'),replyId:id,text:z.string().trim().min(1).max(4000),reviewed:z.literal(true)}).strict(),
])
export async function sidebarAction(runtime:PennyRuntime,token:string,input:z.infer<typeof actionInput>){
 const c=await activeConnection(runtime),tokenHash=await digest(token)
 const context=await runtime.database.binding.prepare('SELECT conversation_id FROM penny_helpscout_contexts WHERE token_hash=? AND connection_id=? AND revision=? AND user_id=? AND expires_at>?').bind(tokenHash,c.id,c.revision,c.sidebar_user_id,Date.now()).first<{conversation_id:number}>()
 if(!context)throw new NativeError('helpscout_context_expired',401)
 const db=connectionDb(runtime,c,{sql:"EXISTS(SELECT 1 FROM penny_helpscout_contexts WHERE token_hash=? AND expires_at>unixepoch('subsec')*1000)",params:[tokenHash]})
 const conversationId=context.conversation_id,now=new Date().toISOString()
 if(input.action==='capture'){await enqueue(runtime,c,conversationId,'sidebar');return {queued:true}}
 if(input.action==='search')return {requests:(await db.prepare(approvedSql+' AND (instr(lower(r.public_title),lower(?))>0) ORDER BY r.created_at DESC,r.id LIMIT 25').bind(input.query).all()).results}
 let row=await db.prepare('SELECT * FROM penny_helpscout_captures WHERE connection_id=? AND conversation_id=?').bind(c.id,conversationId).first<Capture>()
 if(input.action==='view'){
  if(row?.evidence_id)await prepareReplies(runtime,c,now,row.evidence_id)
  const linked=row?.request_id?await db.prepare(approvedSql+' AND r.id=?').bind(row.request_id).first():null
  return {conversationId,sourceUrl:sourceUrl(conversationId),capture:row?{state:row.state,failure:row.state==='failed'?'Capture failed. Ask the owner to retry in settings.':row.failure,sourceState:row.source_state,evidenceId:row.evidence_id}:null,linked,replies:linked&&row?.evidence_id?(await db.prepare(`SELECT id,body,state FROM penny_helpscout_replies WHERE evidence_id=? AND status_id=(SELECT ${publicRevisionSql} FROM requests r WHERE r.id=?) ORDER BY created_at DESC LIMIT 1`).bind(row.evidence_id,row.request_id).all()).results:[]}
 }
 if(!row?.evidence_id||row.state!=='done'||!['current','changed'].includes(row.source_state))throw new NativeError('helpscout_capture_not_ready',409)
 if(input.action==='send')return sendReply(runtime,c,db,conversationId,input.replyId,input.text)
 if(input.action==='vote'){
  if(!row.request_id)throw new NativeError('helpscout_link_required',409)
  const person=await db.prepare('SELECT requester_id FROM evidence_items WHERE id=?').bind(row.evidence_id).first<string>('requester_id')
  if(!person)throw new NativeError('helpscout_customer_unmapped',409)
  const request=await db.prepare('SELECT slug FROM requests WHERE id=?').bind(row.request_id).first<string>('slug')
  const safe=await redactCaptured(db,{source:input.source},['source'])
  return recordProxyVote(db,request!,{requesterId:person,source:safe.input.source,sourceUrl:sourceUrl(conversationId),evidenceId:row.evidence_id},c.actor_id)
 }
 if(row.request_id){if(input.action==='link'&&row.request_id!==input.requestId)throw new NativeError('helpscout_already_linked',409);return {requestId:row.request_id,duplicate:true}}
 const commit=connectionDb(runtime,c,{sql:"EXISTS(SELECT 1 FROM penny_helpscout_contexts WHERE token_hash=? AND expires_at>unixepoch('subsec')*1000) AND EXISTS(SELECT 1 FROM penny_helpscout_captures WHERE connection_id=? AND conversation_id=? AND request_id IS NULL AND state='done')",params:[tokenHash,c.id,conversationId]})
 try{
  if(input.action==='create'){
   const safe=await redactCaptured(commit,{title:input.title,description:input.description},['title','description']),fence=redactionFence(commit,safe.revision)
   return await createOperatorRequest({binding:commit},{...safe.input,boardSlug:input.boardSlug,evidenceIds:[row.evidence_id]},c.actor_id,requestId=>[fence.before,fence.after,commit.prepare('UPDATE penny_helpscout_captures SET request_id=? WHERE connection_id=? AND conversation_id=?').bind(requestId,c.id,conversationId)])
  }
  if(!await commit.prepare('SELECT id FROM requests WHERE id=? AND withdrawn_at IS NULL AND merged_into_request_id IS NULL').bind(input.requestId).first())throw new NativeError('not_found',404)
  await commit.batch([
   commit.prepare('INSERT INTO request_evidence_links(request_id,evidence_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(input.requestId,row.evidence_id,now),
   commit.prepare('INSERT INTO request_evidence_contributions(request_id,evidence_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(input.requestId,row.evidence_id,now),
   commit.prepare('UPDATE penny_helpscout_captures SET request_id=? WHERE connection_id=? AND conversation_id=?').bind(input.requestId,c.id,conversationId),
   audit(commit,c.actor_id,'evidence',row.evidence_id,'helpscout.linked',now),
  ])
  return {requestId:input.requestId}
 }catch(error){row=await db.prepare('SELECT * FROM penny_helpscout_captures WHERE connection_id=? AND conversation_id=?').bind(c.id,conversationId).first<Capture>();if(row?.request_id)return {requestId:row.request_id,duplicate:true};throw error}
}
