/** The server runner's progress for the operation holding the workspace (data/runner/status.ts). */
export type Progress = { stage: 'records' | 'imports' | 'files' | 'restore'; state: 'working' | 'retrying' | 'waiting' | 'stopped'; steps: number; reason: string | null; canCancel: boolean; needsBackup: boolean }
export type Overview = { hosted:boolean;canExport?:boolean;ownExport?:{jobId:string|null;phase:string|null;completed:number}|null; targets: { table: string; id: string; label: string }[]; operation: { id: string; kind: string; status: string; progress: Progress | null } | null; recent: { id: string; kind: string; result: 'complete' | 'aborted'; reason: string | null; finishedAt: number } | null }
export type BlockedCopy = { table: string; key: string; columns: string[]; action?: string; occurredAt?: string; resolvable?: true; values?: Record<string, { current: string; redacted: string }>; label?: string | null; href?: string | null }
export type AuditChoices = Record<string, 'unrelated' | 'clear'>
export type CopyChoice = { resolution: 'redact' | 'rename'; values?: Record<string, string> }
export type CopyChoices = Record<string, CopyChoice>
export const auditCopyId = (copy: BlockedCopy) => (JSON.parse(copy.key) as string[])[0]
export const copyId = (copy: BlockedCopy) => copy.table + ':' + copy.key
export const choicesComplete = (copies: BlockedCopy[], choices: CopyChoices) => copies.every(copy => { const choice = choices[copyId(copy)]; return !!choice && (choice.resolution === 'redact' || copy.columns.every(name => choice.values?.[name]?.trim())) })
export type Plan = { table: string; id: string; planHash: string; counts: Record<string, number>; kept?: Record<string, number>; fileCount: number; importCount: number; blockedCopies: BlockedCopy[] }
export type Receipt = { operationId: string; status: string }
const messages: Record<string, string> = {
  private_views_export_refused: 'A private saved view belongs to another operator. Ask its creator to share or delete it before backing up this workspace.',
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
  erasure_ambiguous_copies: 'Other records repeat this wording, so Penny cannot tell whether it came from this person. Preview erasure again to see which records, reword them, then erase.',
  erasure_rename_repeats: 'A new name still repeats this person’s words. Choose different wording.',
  erasure_crosses_operator_hold: 'This action includes a protected operator identity.',
  unauthenticated: 'Your session has ended. Sign in again to continue.',
  restore_backup_needed: 'Choose the same backup file again below to resume this restore.',
  restore_upload_incomplete: 'The backup upload did not finish, so nothing was restored. Choose the backup again.',
  erasure_not_started: 'The erasure stopped before it began, so nothing was removed. Preview it again.',
  data_runner_superseded: 'Penny already continued this on the server. Reload the page to see where it is.',
  invalid_data_operation: 'This operation has already finished. Reload the page.',
}
/** Why a step stopped or was refused, in plain words, for the progress and outcome cards. */
export const reasonText = (code: string | null): string => code === null ? '' : ({
  files_unavailable: 'Penny could not reach file storage.',
  operator_authority_changed: 'The person who started it no longer has access, or their role changed. Resume it to continue as yourself.',
  stopped_before_upgrade: 'It stopped before this version of Penny could finish it on its own.',
  import_failed: 'The import stopped on a record it could not apply.',
  step_failed: 'A step did not finish.',
  data_runner_superseded: 'Another step took over.',
} as Record<string, string>)[code] ?? messages[code] ?? 'A step did not finish.'
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
export { recordWords } from './record-words'
export const entityLabels: Record<string, string> = { requesters: 'Requesters', requests: 'Feedback', evidence_items: 'Evidence', accounts: 'Accounts', operators: 'Former operators' }
export async function previewErasure(table:string,id:string):Promise<Plan>{
 let result=await mutate<Plan|{status:'pending';continuation:string}>('erasure/preview',{table,id})
 while('status' in result&&result.status==='pending')result=await mutate<Plan|{status:'pending';continuation:string}>('erasure/preview',{table,id,continuation:result.continuation})
 return result as Plan
}
