import {drainLearning} from '../learning/scheduled'
import { createPennyRuntime } from '@/core/app/runtime'
import type { AppBindings } from '@/core/shared/bindings'
import { drainDecisionReviews } from './decision-reviews'
import { drainNotifications } from './delivery'
import { drainRejectionNotices } from './rejection-delivery'
import { drainReleaseDeliveries } from '../releases/delivery'
import {drainIntegrations} from '../integrations/delivery'
import {drainTrackers} from '../integrations/tracker-delivery'

/** The default Worker's scheduled event handler. */
export async function runNotificationSchedule(_controller:ScheduledController,bindings:AppBindings):Promise<void>{
 const runtime=createPennyRuntime(bindings)
 await drainLearning(runtime,_controller.scheduledTime)
 await drainDecisionReviews(runtime)
 await drainNotifications(runtime)
 await drainRejectionNotices(runtime)
 await drainReleaseDeliveries(runtime)
 await drainIntegrations(runtime)
 await drainTrackers(runtime)
}
