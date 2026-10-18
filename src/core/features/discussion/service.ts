import { NativeError } from '../auth/native-tokens'
export interface NoteInput { body:string; parentNoteId?:string|null; mentionOperatorIds?:string[]; idempotencyKey?:string }
export const activeOperators = `SELECT p.id,p.display_name AS displayName FROM operators p JOIN oa_operators n ON n.email=p.email WHERE n.status='active' ORDER BY p.display_name,p.id`

/** The caller supplies a database guarded by current native session authority. */
export async function addInternalNote(db:D1Database,slug:string,actor:string,input:NoteInput,now:string):Promise<{id:string}>{
 const body=input.body.trim(),mentions=[...new Set(input.mentionOperatorIds??[])].sort()
 if(!body||body.length>20000||mentions.length>50)throw new NativeError('invalid_note',400)
 const request=await db.prepare('SELECT id FROM requests WHERE slug=?').bind(slug).first<{id:string}>()
 if(!request)throw new NativeError('not_found',404)
 const id=input.idempotencyKey??crypto.randomUUID(),parent=input.parentNoteId??null
 const prior=await db.prepare('SELECT request_id,operator_id,body,parent_note_id FROM request_notes WHERE id=?').bind(id).first<{request_id:string;operator_id:string;body:string;parent_note_id:string|null}>()
 if(prior){
  const rows=await db.prepare('SELECT operator_id FROM penny_note_mentions WHERE note_id=? ORDER BY operator_id').bind(id).all<{operator_id:string}>()
  if(prior.request_id!==request.id||prior.operator_id!==actor||prior.body!==body||prior.parent_note_id!==parent||JSON.stringify(rows.results.map(r=>r.operator_id))!==JSON.stringify(mentions))throw new NativeError('note_key_conflict',409)
  return {id}
 }
 const guard=crypto.randomUUID()
 const assert=(condition:string,values:(string|null)[])=>db.prepare('INSERT INTO penny_discussion_guards(id,allowed) VALUES(?,CASE WHEN '+condition+' THEN 1 ELSE 0 END)').bind(guard,...values)
 const checks=mentions.map(operator=>assert("EXISTS(SELECT 1 FROM operators p JOIN oa_operators n ON n.email=p.email WHERE p.id=? AND n.status='active')",[operator]))
 // Each guard has its own key; deleting within the batch leaves no durable authority.
 const statements=checks.flatMap(check=>[check,db.prepare('DELETE FROM penny_discussion_guards WHERE id=?').bind(guard)])
 if(parent)statements.push(assert('EXISTS(SELECT 1 FROM request_notes WHERE id=? AND request_id=? AND parent_note_id IS NULL)',[parent,request.id]),db.prepare('DELETE FROM penny_discussion_guards WHERE id=?').bind(guard))
 try{await db.batch([...statements,
  db.prepare('INSERT INTO request_notes(id,request_id,operator_id,body,parent_note_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,request.id,actor,body,parent,now,now),
  ...mentions.map(operator=>db.prepare('INSERT INTO penny_note_mentions(note_id,operator_id,created_at) VALUES(?,?,?)').bind(id,operator,now)),
  db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,'request.note_added','request',?,?,?,?)`).bind(crypto.randomUUID(),actor,request.id,now,now,now),
 ])}catch(error){if(String(error).includes('UNIQUE constraint failed: request_notes.id'))return addInternalNote(db,slug,actor,input,now);if(/penny_discussion_admitted|invalid_note_parent/.test(String(error)))throw new NativeError('discussion_target_changed',409);throw error}
 return {id}
}
export async function mentionNotices(db:D1Database,actor:string){
 return (await db.prepare(`SELECT m.note_id AS noteId,m.created_at AS createdAt,n.body,n.parent_note_id AS parentNoteId,r.slug,r.id AS requestId,r.title,o.display_name AS author
 FROM penny_note_mentions m JOIN request_notes n ON n.id=m.note_id JOIN requests r ON r.id=n.request_id LEFT JOIN operators o ON o.id=n.operator_id
 WHERE m.operator_id=? AND m.dismissed_at IS NULL ORDER BY m.created_at DESC,m.note_id`).bind(actor).all()).results
}
