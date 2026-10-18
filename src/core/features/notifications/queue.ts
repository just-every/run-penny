import type { PennyRuntime } from '@/core/app/runtime'
import { createPennyRuntime } from '@/core/app/runtime'
import type { AppBindings } from '@/core/shared/bindings'
import {workspaceClock,withinQuietHours} from '../settings/workspace-clock'
import { drainRequesterMail } from './scheduled'
import { priorRequestUpdatesSettled } from '../releases/delivery-order'

const command = { kind: 'notifications.drain' } as const

/** Publications commit their intents before Queue acceptance. Cron recovers a
 * failed kickoff; the same durable claims fence overlapping Queue/Cron drains. */
export async function queueNotificationWork(runtime: PennyRuntime, delaySeconds = 0): Promise<void> {
 await runtime.bindings.JOBS.send(command, { delaySeconds })
}

/** Only routes capable of publishing mail intents need an event-time wakeup. */
export function publishesNotification(method: string, path: string): boolean {
 if (method !== 'POST') return false
 return /^\/api\/operator\/(?:requests\/[^/]+\/(?:comments|status-updates|merge|decline\/reverse)|comments\/(?:edits\/)?[^/]+\/moderate|(?:requests\/[^/]+\/moderate|moderation\/[^/]+)|requests\/edits\/[^/]+\/moderate|releases\/[^/]+\/(?:publish|versions\/[^/]+\/deliver)|roadmap-updates\/[^/]+\/publish)$/.test(path)
  || /^\/api\/v1\/(?:requests\/[^/]+\/(?:comments|status-updates)|releases\/[^/]+\/publish)$/.test(path)
}

export async function runNotificationQueue(batch: MessageBatch<unknown>, bindings: AppBindings): Promise<void> {
 if (batch.messages.some(message => !message.body || typeof message.body !== 'object'
  || (message.body as {kind?:unknown}).kind !== command.kind)) throw new Error('invalid_notification_job')
 const runtime = createPennyRuntime(bindings)
 await drainRequesterMail(runtime)
 const delay = await nextNotificationDelay(runtime)
 // Accept the continuation before acknowledging this batch. A crash can leave
 // duplicate wakeups, never an unowned or automatically replayed mail attempt.
 if (delay !== undefined) await queueNotificationWork(runtime, delay)
 batch.ackAll()
}

async function nextNotificationDelay(runtime: PennyRuntime): Promise<number | undefined> {
 const db = runtime.database.binding, now = Date.now()
 if ((await db.prepare('SELECT phase FROM data_state WHERE singleton=1').first<{phase:string}>())?.phase !== 'idle') return
 const row = await db.prepare(`SELECT MIN(due) AS due FROM (
  SELECT next_attempt_at AS due FROM notification_batches WHERE state='queued' AND failure_reason IS NOT 'restored_delivery_review_required'
  UNION ALL SELECT strftime('%Y-%m-%dT%H:%M:%fZ',updated_at,'+5 minutes') FROM notification_batches WHERE state='sending'
  UNION ALL SELECT available_at FROM notification_outbox n WHERE delivery_state='queued' AND claim_id IS NULL
   AND (event_type='moderation_rejected' OR (event_type='release_version' AND ${priorRequestUpdatesSettled('n')}))
  UNION ALL SELECT strftime('%Y-%m-%dT%H:%M:%fZ',updated_at,'+5 minutes') FROM notification_outbox WHERE delivery_state='queued' AND claim_id IS NOT NULL
  UNION ALL SELECT created_at FROM notification_intents WHERE batch_id IS NULL AND restoration_hold_at IS NULL
 )`).first<{due:string|null}>()
 if (!row?.due) return
 const clock=await workspaceClock(runtime)
 let at = Math.max(now + 1000, Date.parse(row.due))
 // Queue delays cover twelve hours; longer quiet periods get another wakeup.
 // Minute boundaries retain half/quarter-hour zones and daylight-saving rules.
 while (at < now + 43_200_000 && withinQuietHours(new Date(at),clock)) at = Math.floor(at / 60000) * 60000 + 60000
 return Math.min(43_200, Math.max(1, Math.ceil((at - now) / 1000)))
}
