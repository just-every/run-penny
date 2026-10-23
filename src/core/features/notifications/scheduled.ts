import {drainScheduledPublications} from '../releases/scheduled'
import {drainAging} from '../triage/reminders'
import {advanceDataWork} from '../data/runner/advance'
import {drainLearning} from '../learning/scheduled'
import { createPennyRuntime, type PennyRuntime } from '@/core/app/runtime'
import type { AppBindings } from '@/core/shared/bindings'
import { drainDecisionReviews } from './decision-reviews'
import { drainNotifications } from './delivery'
import { drainRejectionNotices } from './rejection-delivery'
import { drainReleaseDeliveries } from '../releases/delivery'
import {drainIntegrations} from '../integrations/delivery'
import {drainTrackers} from '../integrations/tracker-delivery'
import {prepareWeekly} from './weekly-schedule'
import {drainWeekly} from './weekly-delivery'

/** The default Worker's scheduled event handler. */
export async function runNotificationSchedule(_controller:ScheduledController,bindings:AppBindings):Promise<void>{
 const runtime=createPennyRuntime(bindings)
 // A confirmed data operation finishes first: the drains below wait for an idle workspace.
 await advanceDataWork(bindings)
 await drainLearning(runtime,_controller.scheduledTime)
 await drainDecisionReviews(runtime)
 await drainAging(runtime.database.binding)
 await drainScheduledPublications(runtime.database.binding,_controller.scheduledTime)
 await prepareWeekly(runtime,_controller.scheduledTime)
 await drainRequesterMail(runtime,()=>_controller.scheduledTime)
 await drainIntegrations(runtime)
 await drainTrackers(runtime)
}

/** Queue and Cron share this order: status digests precede release notes. */
export async function drainRequesterMail(runtime:PennyRuntime,weeklyClock=Date.now):Promise<void>{
 await drainNotifications(runtime)
 await drainRejectionNotices(runtime)
 await drainReleaseDeliveries(runtime)
 await drainWeekly(runtime,weeklyClock)
}
