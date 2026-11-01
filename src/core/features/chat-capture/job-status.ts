import {z} from 'zod'
import {NativeError} from '../auth/native-tokens'

// Retrying is still unresolved. Only that job's success or an explicit stop
// clears its failure; unrelated source checks must not conceal it.
const unresolved="state IN('pending','running','failed') AND failure IS NOT NULL"
export function failureSummary(db:D1Database,id:string){
 return db.prepare(`UPDATE penny_chat_connections SET last_failure=(SELECT failure FROM penny_chat_jobs WHERE connection_id=? AND ${unresolved} ORDER BY created_at DESC,id DESC LIMIT 1) WHERE id=?`).bind(id,id)
}
const queryInput=z.object({
 connectionId:z.string().min(1).max(128).optional(),
 state:z.enum(['pending','running','failed','succeeded','stopped','unresolved']).optional(),
 limit:z.coerce.number().int().min(1).max(100).default(100),
 cursor:z.string().regex(/^\d{1,16}:[0-9a-f-]{36}$/).optional(),
}).strict()
export async function chatStatus(db:D1Database,input:Record<string,string>){
 const parsed=queryInput.safeParse(input)
 if(!parsed.success)throw new NativeError('invalid_capture_query',400)
 const {connectionId,state,limit,cursor}=parsed.data,where:string[]=[],params:(string|number)[]=[]
 if(connectionId){where.push('connection_id=?');params.push(connectionId)}
 if(state==='unresolved')where.push(unresolved)
 else if(state){where.push('state=?');params.push(state)}
 if(cursor){const [time,id]=cursor.split(':');where.push('(created_at<? OR (created_at=? AND id<?))');params.push(Number(time),Number(time),id)}
 const connections=(await db.prepare(`SELECT id,team_id,app_id,channels_json,mappings_json,reaction,purge_days,state,last_success_at,
  CASE WHEN state='revoked' THEN last_failure ELSE (SELECT failure FROM penny_chat_jobs WHERE connection_id=c.id AND ${unresolved} ORDER BY created_at DESC,id DESC LIMIT 1) END last_failure,
  (SELECT COUNT(*) FROM penny_chat_jobs WHERE connection_id=c.id AND ${unresolved}) unresolved_failure_count
  FROM penny_chat_connections c ORDER BY created_at,id`).all()).results
 const rows=(await db.prepare(`SELECT id,connection_id,channel_id,message_ts,capturer,kind,state,attempts,due_at,failure,created_at FROM penny_chat_jobs ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(...params,limit+1).all<{created_at:number;id:string}>()).results
 const jobs=rows.slice(0,limit),last=jobs.at(-1)
 return {connections,jobs,nextCursor:rows.length>limit&&last?last.created_at+':'+last.id:null}
}
