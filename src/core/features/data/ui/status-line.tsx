import type { Status } from './data-page-parts'

/** A data action's progress or result, beside the control that started it. */
export function StatusLine({ status, className = '' }: { status: NonNullable<Status>; className?: string }) {
  return <p role={status.kind === 'error' ? 'alert' : 'status'} className={`${className} rounded-lg border bg-penny-card p-4 text-sm leading-6 font-medium text-penny-ink ${status.kind === 'error' ? 'border-penny-danger' : 'border-penny-line-strong/60'}`}>{status.text}</p>
}
