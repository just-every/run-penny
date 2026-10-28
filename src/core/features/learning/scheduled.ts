import { pennyAgentDoor } from '../agent-door/index'
import {NativeError} from '../auth/native-tokens'
import type {PennyRuntime} from '@/core/app/runtime'
import {runInvestigation} from './run'
import {systemLearningAudit} from './audit'
/** Scheduled minute events refresh bounded, explicitly selected source targets.
 * Durable event keys and unique running claims admit at most one acquisition.
 * Errors remain per-investigation receipts; another valid grant keeps moving. */
export async function drainLearning(runtime:PennyRuntime,scheduledTime:number){
 const rows=(await runtime.database.binding.prepare("SELECT id,next_run_at,version FROM learning_investigations WHERE state='active' AND next_run_at<=? ORDER BY next_run_at,id LIMIT 10").bind(new Date(scheduledTime).toISOString()).all<{id:string;next_run_at:string;version:number}>()).results
 const db=runtime.database.binding
 for(const row of rows){try{
 const work=await db.prepare("SELECT principal FROM penny_agent_work WHERE kind='learning' AND id=?").bind(row.id).first<{principal:string}>()
 const eventKey=`scheduled:${row.version}:${row.next_run_at}`
 if(work){const result=await pennyAgentDoor(runtime).invoke('penny.learning.execute',{id:row.id,eventKey,idempotency_key:eventKey},JSON.parse(work.principal));if(result.outcome==='pending')continue;if(result.outcome!=='done')throw new NativeError(result.code??'agent_approval_required',409)}
 else await runInvestigation(runtime,row.id,eventKey,{db,actor:{system:'learning.scheduler'}})}catch(error){const reason=error instanceof NativeError?error.code:'learning_unavailable';await db.batch([db.prepare("UPDATE learning_investigations SET last_reason=?,state='paused' WHERE id=? AND version=?").bind(reason,row.id,row.version),systemLearningAudit(db,'learning.scheduler','learning_investigation',row.id,'learning.schedule_paused',{reason},true)])}}
}
