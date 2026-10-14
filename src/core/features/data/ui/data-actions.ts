export type Overview = { hosted:boolean;commands:{restore:string;preview:string;erase:string;status:string}; targets: { table: string; id: string; label: string }[]; operation: { id: string; kind: string; status: string } | null; epoch: number }
export type Plan = { table: string; id: string; planHash: string; counts: Record<string, number>; fileCount: number; blockedCopies: { table: string; key: string; columns: string[] }[] }
export type Receipt = { operationId: string; status: string }
const messages: Record<string, string> = {
  restore_requires_empty_target: 'This workspace already has records. Restore into an empty, migrated workspace.',
  restore_requires_empty_bucket: 'This workspace already has files. Restore into an empty file store.',
  stale_archive: 'This backup predates the supplied erasure journal. Export a fresh backup.',
  erasure_journal_regression: 'This journal would discard known erasures. Use the latest source journal.',
  erased_archive_record: 'This backup contains an erased record. Export a fresh backup.',
  archive_corrupt: 'The backup or an original file failed its checksum.',
  data_busy: 'Another data operation is in progress. Complete it before starting another.',
  data_operation_mismatch: 'Resume with the same backup and journal used to start this restore.',
  data_runner_busy: 'This operation is already running. Wait for it to finish.',
  erasure_plan_changed: 'The records changed. Preview erasure again.',
  erasure_ambiguous_copies: 'Unrelated copies need provenance review before erasure.',
  erasure_crosses_operator_hold: 'This action includes a protected operator identity.',
  unauthenticated: 'Your session has ended. Sign in again to continue.',
}
export class DataActionError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, status: number) { super(messages[code] ?? `Data action could not complete (${code}).`); this.code = code; this.status = status }
}
async function request(path: string, value?: unknown): Promise<Response> {
  const response = await fetch('/api/operator/data/' + path, {
    method: value === undefined ? 'GET' : 'POST',
    ...(value === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }),
  })
  if (!response.ok) {
    const result = await response.json() as { error?: string }
    throw new DataActionError(result.error ?? String(response.status), response.status)
  }
  return response
}
export async function mutate<T>(path: string, value: unknown): Promise<T> {
  const response = await request(path, value)
  return response.status === 204 ? null as T : await response.json() as T
}
export async function downloadPrivate(path: string, filename: string): Promise<void> {
  const response = await request(path), url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url; link.download = filename; link.hidden = true
  document.querySelector<HTMLBodyElement>('body')?.appendChild(link)
  try { link.click() } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
}
export const entityLabels: Record<string, string> = { requesters: 'Requesters', requests: 'Feedback', evidence_items: 'Evidence', accounts: 'Accounts', operators: 'Former operators' }
export const recordLabel = (table: string): string => ({
  requests: 'Feedback', evidence_items: 'Evidence items', evidence_versions: 'Evidence history', request_evidence_links: 'Evidence links', requesters: 'Requesters', requester_addresses: 'Email addresses', attachments: 'Original attachments',
  audit_anonymized: 'Audit references to anonymize', native_magic_links: 'Sign-in links', local_auth_outbox: 'Prepared sign-in links',
  native_requester_sessions: 'Requester sessions', native_rate_limits: 'Rate-limit entries', native_moderation_events: 'Moderation history',
  request_submission_keys: 'Submission reservations',
  operators: 'Operator identity', oa_operators: 'Sign-in identity', operator_sessions: 'Operator sessions', audit_entries: 'Audit details to clear', oa_external_identities: 'Identity-provider links',
  'release_versions:author_name': 'Release author names', 'request_comments:public_author_display_name': 'Comment author names', 'requests:public_author_display_name': 'Feedback author names',
  notification_attempts: 'Mail attempts', notification_outbox_attempts: 'Mail attempts',
}[table] ?? table.replaceAll('_', ' '))

export async function previewErasure(table:string,id:string):Promise<Plan>{
 let result=await mutate<Plan|{status:'pending';continuation:string}>('erasure/preview',{table,id})
 while('status' in result&&result.status==='pending')result=await mutate<Plan|{status:'pending';continuation:string}>('erasure/preview',{table,id,continuation:result.continuation})
 return result as Plan
}
