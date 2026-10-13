import { initializeD1ImportStorage } from '../../base/modules/import-kit/src/d1/index'
import type { SavedFeedbackInput } from '@/core/features/imports/types'
import { env } from './support'
import { populateFeedback } from './feedback-import-fixture'

/** Populate genuine native records using the maintained mapper/engine, then
 * retain only the historical schema and its original creation witnesses. This
 * is test data preparation, not an application schema-initialization path. */
export async function populateLegacyFeedback(input:SavedFeedbackInput,operator:Record<string,string>,partial=false) {
 const objects=()=>env.DB.prepare("SELECT type,name FROM sqlite_master WHERE type IN ('table','trigger') AND name NOT LIKE 'sqlite_%'").all<{type:string;name:string}>()
 const before=new Set((await objects()).results.map(row=>row.name))
 await initializeD1ImportStorage(env.DB)
 const job=await populateFeedback(input,operator,partial)
 const added=(await objects()).results.filter(row=>!before.has(row.name))
 await env.DB.batch([env.DB.prepare('PRAGMA defer_foreign_keys=ON'),
  ...added.filter(row=>row.type==='trigger').map(row=>env.DB.prepare('DROP TRIGGER "'+row.name+'"')),
  ...added.filter(row=>row.type==='table').map(row=>env.DB.prepare('DROP TABLE "'+row.name+'"')),
  env.DB.prepare('INSERT INTO ik_d1_creation_plans(job_id,ordinal,body) SELECT job_id,ordinal,body FROM ik_d1_plan_chunks WHERE job_id=?').bind(job.id),
 ])
 return job
}
