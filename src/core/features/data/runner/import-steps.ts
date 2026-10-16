import type { PennyRuntime } from '@/core/app/runtime'
import { feedbackJob, type ImportPrincipal } from '../../imports/service'
import type { DataAuthority } from '../authority'
import { importWorkId, registerWork, type Claim } from './claims'
import { runSteps, type StepOutcome } from './drive'
import { queueDataWork } from './queue'

type Job = { id: string; state: string; checkpoint: number; total: number }
const settled = ['completed', 'undone', 'rolled_back']
/** A failed job waits for its owner: resume it, or roll back what applied.
 * Each step fills one request's budget, so the next starts fresh. */
const outcome = (job: Job): StepOutcome => settled.includes(job.state) ? { state: 'done' } : job.state === 'failed' ? { state: 'stopped', code: 'import_failed' } : { state: 'more', fresh: true }

/** The confirming owner's standing, checked by Base inside every batch. */
function standingPrincipal(claim: Claim, authority: DataAuthority): ImportPrincipal {
 return {
  predicate: () => ({ sql: "EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND o.status='active' AND o.role='owner' AND o.version=?) AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle')", params: [authority.operatorId, authority.operator.version] }),
  actorId: claim.row.actor_id!, operatorId: authority.operatorId, database: claim.db,
 }
}
/** One server step of a saved import: it continues whichever direction the
 * job is going (apply, undo or roll back). */
export async function importStep(runtime: PennyRuntime, claim: Claim, authority: DataAuthority): Promise<StepOutcome> {
 return outcome(await feedbackJob(runtime, standingPrincipal(claim, authority), claim.workId.slice(importWorkId('').length), 'resume') as Job)
}

/** An owner's import action runs one step here; while the job is unsettled the
 * server continues it as that owner, so the tab can close. */
export async function runImportAction(runtime: PennyRuntime, principal: ImportPrincipal, id: string, action: 'resume' | 'undo' | 'rollback'): Promise<Job> {
 const db = runtime.database.binding, workId = importWorkId(id)
 if (!principal.session || !await db.prepare('SELECT 1 FROM ik_jobs WHERE id=?').bind(id).first()) return await feedbackJob(runtime, principal, id, action) as Job
 await registerWork(db, workId, 'import', principal.session as DataAuthority, principal.actorId).run()
 let job: Job | undefined
 await runSteps(db, workId, async claim => outcome(job = await feedbackJob(runtime, { ...principal, database: claim.db }, id, action) as Job))
 job ??= await feedbackJob(runtime, principal, id, 'read') as Job
 if (!settled.includes(job.state)) await queueDataWork(runtime.bindings.JOBS)
 return job
}

/** A just-applied import that has more to do continues on the server. */
export async function continueImport(runtime: PennyRuntime, principal: ImportPrincipal, job: Job): Promise<void> {
 if (settled.includes(job.state) || !principal.session) return
 await registerWork(runtime.database.binding, importWorkId(job.id), 'import', principal.session as DataAuthority, principal.actorId).run()
 await queueDataWork(runtime.bindings.JOBS)
}
