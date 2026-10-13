import { clauseScreenStates } from './loopjourney-clause-states.mjs'
import { clauseEvidence } from './loopjourney-clause-evidence.mjs'
import { clauseReleases } from './loopjourney-clause-releases.mjs'
import { clauseDecisions } from './loopjourney-clause-decisions.mjs'
import { browserOptions } from './browser-options.mjs'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createAudit, evidenceDirectory, viewports } from './acceptance-audit.mjs'
import { freshLocalRuntime } from './fresh-local-runtime.mjs'
import { signIn, verifyRequester } from './local-signin.mjs'
import { waitForLocalCapacity } from './local-resource-limits.mjs'
import { boundedStep, createBoard, createDecision, moderateAndFollow, recordEvidence, submitFeedback } from './loopjourney-steps.mjs'
import { approveRoadmap, moveRoadmap } from './loopjourney-roadmap.mjs'
import { createTag, draftAndPublishRelease, expectFollowerQueued, expectPublicUpdates, expectReleaseQueued, publishStatusUpdate } from './loopjourney-release.mjs'
import { editingRecovery,recoveryHttpErrors } from './loopjourney-resource-recovery.mjs'

// E.1: the whole operator loop from an empty local store, through the real UI only.
const output = evidenceDirectory('decision-loop')
process.env.TMPDIR = resolve(process.env.PENNY_WORK_ROOT ?? '..', 'tmp')
await mkdir(process.env.TMPDIR, { recursive: true })
let browser
try {
  await waitForLocalCapacity()
  browser = await chromium.launch(browserOptions())
  for (const viewport of viewports) {
    const runtime = await freshLocalRuntime(viewport, output)
    let operatorContext, requesterContext, journeyError
    try {
      operatorContext = await browser.newContext({ viewport })
      requesterContext = await browser.newContext({ viewport })
      for (const context of [operatorContext, requesterContext]) {
        context.setDefaultTimeout(30_000)
        context.setDefaultNavigationTimeout(45_000)
      }
      const expectedHttpErrors=[]
      const operatorAudit = await createAudit(operatorContext, runtime.origin, output, viewport,{expectedHttpErrors})
      const requesterAudit = await createAudit(requesterContext, runtime.origin, output, viewport)
      for (const capture of [operatorAudit, requesterAudit]) {
        const audit = capture.audit
        capture.audit = (page, label, options) => boundedStep(page, `Capture ${label}`, () => audit(page, label, options), {timeout:60_000})
      }
      const operator = await operatorContext.newPage(), requester = await requesterContext.newPage()
      await signIn(operator, runtime, operatorAudit.audit)
      await createBoard(operator, runtime.origin, operatorAudit.audit)
      await verifyRequester(requester, runtime, requesterAudit.audit)
      await submitFeedback(requester, runtime.origin, requesterAudit.audit)
      const requestSlug = await moderateAndFollow(operator, requester, runtime.origin, operatorAudit.audit)
      const accountContext=await clauseEvidence(operator, requester, runtime.origin, operatorAudit.audit, requesterAudit.audit)
      await recordEvidence(operator, runtime.origin, operatorAudit.audit)
      await createTag(operator, runtime.origin, operatorAudit.audit)
      const commit = await createDecision(operator, runtime.origin, operatorAudit.audit)
      expectedHttpErrors.push(...recoveryHttpErrors(commit.itemId))
      await editingRecovery(operator,runtime.origin,operatorAudit.audit,commit)
      const projection = await approveRoadmap(operator, requester, runtime, operatorAudit.audit, commit, requestSlug)
      await moveRoadmap(operator, runtime.origin, operatorAudit.audit, commit, 'in_progress')
      await publishStatusUpdate(operator, runtime.origin, operatorAudit.audit)
      await moveRoadmap(operator, runtime.origin, operatorAudit.audit, commit, 'shipped')
      const releaseSlug = await draftAndPublishRelease(operator, runtime.origin, operatorAudit.audit)
      await expectPublicUpdates(requester, runtime.origin, requesterAudit.audit)
      await expectFollowerQueued(operator, runtime.origin, operatorAudit.audit)
      await expectReleaseQueued(operator, runtime.origin, releaseSlug, operatorAudit.audit)
      await clauseReleases(operator, requester, runtime.origin, releaseSlug, operatorAudit.audit, requesterAudit.audit)
      await clauseDecisions(operator, runtime, commit, releaseSlug, operatorAudit.audit, accountContext)
      await clauseScreenStates({browser,operator,requester,origin:runtime.origin,output,viewport,releaseSlug})
      const scope = 'Fresh source copy, real local setup, Base development outbox and Worker; empty store, no sample data or manual SQL bootstrap; the clock is never changed; the real local Cron runs a past-dated decision review through the development outbox'
      await operatorAudit.finish('E.1-operator', { clauses: ['EVID', 'DEC', 'ROAD', 'REL'], projection, scope })
      await requesterAudit.finish('E.1-requester', { clauses: ['ROAD-003', 'REL-005'], scope })
    } catch (error) {
      journeyError = error
      try { await runtime.saveDiagnostics() }
      catch (diagnosticError) { journeyError = new AggregateError([error, diagnosticError], 'Decision-loop journey and diagnostic capture failed.') }
    }
    finally {
      const failures = []
      for (const cleanup of [() => operatorContext?.close(), () => requesterContext?.close(), () => runtime.close()]) { try { await cleanup() } catch (error) { failures.push(error) } }
      if (failures.length) journeyError = new AggregateError([journeyError, ...failures].filter(Boolean), 'Decision-loop journey cleanup failed; original failure retained.')
    }
    if (journeyError) throw journeyError
  }
  console.log(`[E.1] Both empty-store decision-loop journeys passed. Evidence: ${output}`)
} finally { await browser?.close() }
