// The original fixtures own their historical rows and beforeAll state. The
// current shared request code also writes 0010 dependants, which those frozen
// fixtures cannot clear. Reset only that added state between predecessor cases.
export const notificationTables = [
  'notification_intents',
  'notification_attempts',
  'notification_batches',
  'notification_events',
  'request_notification_mutes',
  'requester_notification_preferences',
] as const

export async function clearPredecessorNotificationState(database: D1Database): Promise<void> {
  // Upgrade tests start without a schema and apply their own ordered history.
  const installed = await database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notification_events'").first()
  if (!installed) return

  // A pending maintenance operation owns its protected state. Its original
  // recovery fixture performs the complete reset; do not unlock or alter it.
  await database.batch(notificationTables.map(table => database.prepare(
    `DELETE FROM ${table} WHERE (SELECT phase FROM data_state WHERE singleton=1)='idle'`,
  )))
}
