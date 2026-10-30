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
 for(const row of rows){
  try{
   // The next due window is a checkpoint, never permission to retry a call
   // whose previous Worker did not finish. Keep its money reserved and advance
   // the grant version so even a late response cannot publish an artifact.
   const held=await db.batch([
    db.prepare("UPDATE learning_investigations SET state='paused',version=version+1,last_reason='learning_interrupted' WHERE id=? AND version=? AND state='active' AND next_run_at=? AND EXISTS(SELECT 1 FROM learning_runs WHERE investigation_id=? AND state='running')").bind(row.id,row.version,row.next_run_at,row.id),
    systemLearningAudit(db,'learning.scheduler','learning_investigation',row.id,'learning.schedule_paused',{reason:'learning_interrupted'},true),
    db.prepare("UPDATE learning_runs SET state='uncertain',reason='learning_interrupted' WHERE investigation_id=? AND state='running' AND EXISTS(SELECT 1 FROM learning_investigations WHERE id=? AND version=? AND state='paused' AND last_reason='learning_interrupted')").bind(row.id,row.id,row.version+1),
   ])
   if(held[0].meta.changes)continue
   await runInvestigation(runtime,row.id,`scheduled:${row.version}:${row.next_run_at}`,{db,actor:{system:'learning.scheduler'}})
  }catch(error){
   const reason=error instanceof NativeError?error.code:'learning_unavailable'
   await db.batch([db.prepare("UPDATE learning_investigations SET last_reason=?,state='paused' WHERE id=? AND version=?").bind(reason,row.id,row.version),systemLearningAudit(db,'learning.scheduler','learning_investigation',row.id,'learning.schedule_paused',{reason},true)])
  }
 }
}
