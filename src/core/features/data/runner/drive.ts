import { NativeError } from '../../auth/native-tokens'
import { claimStep, readClaim, releaseStep, type Claim } from './claims'

/** One step. `more` with `fresh` used this invocation's request budget (a
 * saved-import step is sized to one request), so the next step runs in a new
 * invocation. `done` with `error` means the work ended refused (nothing more
 * runs) and the caller still hears why. `stalled` made no progress and counts
 * toward a stop; `stopped` waits for a person at once. */
export type StepOutcome = { state: 'more'; fresh?: true } | { state: 'done'; error?: unknown } | { state: 'stalled' | 'stopped'; code: string }
export type Step = (claim: Claim) => Promise<StepOutcome>
export type RunResult = 'done' | 'more' | 'busy' | 'stopped' | 'stalled'
export const errorCode = (error: unknown) => error instanceof NativeError ? error.code : 'step_failed'

/** Runs one piece of work's steps for as long as this invocation holds each
 * claim: until it finishes, stalls, waits for a person, another runner holds
 * it, or a step needs a fresh invocation. A thrown step releases its claim as
 * a failure first. */
export async function runSteps(db: D1Database, workId: string, step: Step): Promise<RunResult> {
 for (;;) {
  const claim = await claimStep(db, workId)
  if (!claim) {
   const row = await readClaim(db, workId)
   return !row || row.stopped_at !== null ? 'stopped' : row.finished_at !== null ? 'done' : 'busy'
  }
  let outcome: StepOutcome
  try { outcome = await step(claim) } catch (error) {
   await releaseStep(claim, { kind: 'failed', code: errorCode(error) })
   throw error
  }
  if (outcome.state === 'done') {
   await releaseStep(claim, { kind: 'finished', outcome: outcome.error === undefined ? undefined : errorCode(outcome.error) })
   if (outcome.error !== undefined) throw outcome.error
   return 'done'
  }
  if (outcome.state === 'stalled') { await releaseStep(claim, { kind: 'failed', code: outcome.code }); return 'stalled' }
  if (outcome.state === 'stopped') { await releaseStep(claim, { kind: 'stopped', code: outcome.code }); return 'stopped' }
  await releaseStep(claim, { kind: 'progress' })
  if ('fresh' in outcome && outcome.fresh) return 'more'
 }
}
