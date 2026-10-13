import { createPennyRuntime } from '@/core/app/runtime'
import type { AppBindings } from '@/core/shared/bindings'
import { drainDecisionReviews } from './decision-reviews'
import { drainNotifications } from './delivery'
import { drainReleaseDeliveries } from '../releases/delivery'
import {drainIntegrations} from '../integrations/delivery'
import {drainTrackers} from '../integrations/tracker-delivery'

/** The default Worker's scheduled event handler. */
export async function runNotificationSchedule(_controller:ScheduledController,bindings:AppBindings):Promise<void>{
 const runtime=createPennyRuntime(bindings)
 await drainDecisionReviews(runtime)
 await drainNotifications(runtime)
 await drainReleaseDeliveries(runtime)
 await drainIntegrations(runtime)
 await drainTrackers(runtime)
}
