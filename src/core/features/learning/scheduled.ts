import {NativeError} from '../auth/native-tokens'
import type {PennyRuntime} from '@/core/app/runtime'
import {runInvestigation} from './run'
/** Scheduled minute events refresh bounded, explicitly selected source targets.
 * Durable event keys and unique running claims admit at most one acquisition.
 * Errors remain per-investigation receipts; another valid grant keeps moving. */
export async function drainLearning(runtime:PennyRuntime,scheduledTime:number){
 const rows=(await runtime.database.binding.prepare("SELECT id,next_run_at,version FROM learning_investigations WHERE state='active' AND next_run_at<=? ORDER BY next_run_at,id LIMIT 10").bind(new Date(scheduledTime).toISOString()).all<{id:string;next_run_at:string;version:number}>()).results
 for(const row of rows){try{await runInvestigation(runtime,row.id,`scheduled:${row.version}:${row.next_run_at}`)}catch(error){const reason=error instanceof NativeError?error.code:'learning_unavailable';await runtime.database.binding.prepare("UPDATE learning_investigations SET last_reason=?,state='paused' WHERE id=? AND version=?").bind(reason,row.id,row.version).run()}}
}
