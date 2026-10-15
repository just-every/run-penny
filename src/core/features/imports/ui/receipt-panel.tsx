import { useState, type ReactNode } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorResourceFailure, OperatorResourceLoading, OperatorResourceNotFound, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { secondaryButtonClass } from '@/core/ui/app/classes'
import type { UserVoiceReceipt } from '../uservoice-receipt'
import { UserVoiceReceiptSection } from './uservoice-receipt'

export interface ImportReceipt {
  phase: string
  sources: { kind: string; read: number; generated: number; eligible: number; applied: number; reused: number; skipped: { reason: string; count: number }[] }[]
  destinations: { table: string; planned: number; created: number; removed: number; retained: number }[]
  omissions: { kind: string; field: string; count: number; reason: string }[]
  aggregates: { field: string; category: string; total: number | null; rows: number }[]
  unresolved: { kind: string; sourceId: string; field: string; target: string }[]
  identities: { kind: string; treatment: string }[]
  effects: { mail: number; notifications: number }
  originalsRetained: boolean
  conflicts: { kind: string; sourceId: string; reason: string }[]
  uservoice?: UserVoiceReceipt
}

const pageSize = 20

function ReceiptPages<T>({ items, label, render }: { items: readonly T[]; label: string; render: (item: T, index: number) => ReactNode }) {
  const [page, setPage] = useState(0)
  const pageCount = Math.ceil(items.length / pageSize)
  const first = page * pageSize
  const visible = items.slice(first, first + pageSize)
  return <>
    <ul className="space-y-2 text-sm leading-6">{visible.map((item, index) => <li key={first + index} className="break-words">{render(item, first + index)}</li>)}</ul>
    {pageCount > 1 ? <div className="flex flex-wrap items-center gap-3 text-sm">
      <span role="status" className="text-penny-muted">Showing {first + 1}–{Math.min(first + pageSize, items.length)} of {items.length} {label}.</span>
      <button type="button" className={secondaryButtonClass} disabled={page === 0} onClick={() => setPage(current => Math.max(0, current - 1))}>Previous page</button>
      <button type="button" className={secondaryButtonClass} disabled={page + 1 >= pageCount} onClick={() => setPage(current => Math.min(pageCount - 1, current + 1))}>Next page</button>
    </div> : null}
  </>
}

function ReceiptTable({ children, label }: { children: ReactNode; label: string }) {
  return <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-penny-line">
    <table aria-label={label} className="w-full min-w-0 table-fixed border-collapse text-left text-xs leading-5 sm:text-sm">
      {children}
    </table>
  </div>
}

function CountCell({ children }: { children: ReactNode }) {
  return <td className="min-w-0 break-words px-2 py-2 align-top tabular-nums sm:px-3">{children}</td>
}

export function ReceiptContent({ receipt, title }: { receipt: ImportReceipt; title: string }) {
  return <section className="space-y-5" aria-label={title}>
    <h3 className="font-bold text-penny-ink">{title}</h3>
    <p className="text-sm leading-6 text-penny-muted">Receipt phase: {receipt.phase}.</p>

    <div className="space-y-2">
      <h4 className="font-bold text-penny-ink">Source rows</h4>
      <div className="hidden sm:block"><ReceiptTable label="Source row counts">
        <thead><tr className="border-b border-penny-line bg-penny-card text-penny-muted"><th className="w-[23%] break-words px-2 py-2 font-medium sm:px-3" scope="col">Kind</th><th className="w-[17%] break-words px-2 py-2 font-medium sm:px-3" scope="col">Read</th><th className="w-[20%] break-words px-2 py-2 font-medium sm:px-3" scope="col">Generated</th><th className="w-[22%] break-words px-2 py-2 font-medium sm:px-3" scope="col">Applied</th><th className="w-[18%] break-words px-2 py-2 font-medium sm:px-3" scope="col">Skipped</th></tr></thead>
        <tbody>{receipt.sources.map(source => <tr key={source.kind} className="border-b border-penny-line last:border-0"><th className="break-words px-2 py-2 align-top font-medium sm:px-3" scope="row">{source.kind}</th><CountCell>{source.read}</CountCell><CountCell>{source.generated}</CountCell><CountCell>{source.applied}<span className="block text-xs text-penny-muted">{source.eligible} eligible · {source.reused} reused</span></CountCell><CountCell>{source.skipped.reduce((sum, item) => sum + item.count, 0)}</CountCell></tr>)}</tbody>
      </ReceiptTable></div>
      <ul className="space-y-2 sm:hidden">{receipt.sources.map(source => <li key={source.kind} className="rounded-lg border border-penny-line p-3"><h5 className="break-words font-bold">{source.kind}</h5><dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><div className="flex justify-between gap-2"><dt>Read</dt><dd className="tabular-nums">{source.read}</dd></div><div className="flex justify-between gap-2"><dt>Generated</dt><dd className="tabular-nums">{source.generated}</dd></div><div className="flex justify-between gap-2"><dt>Applied</dt><dd className="tabular-nums">{source.applied}</dd></div><div className="flex justify-between gap-2"><dt>Ready</dt><dd className="tabular-nums">{source.eligible}</dd></div><div className="flex justify-between gap-2"><dt>Reused</dt><dd className="tabular-nums">{source.reused}</dd></div><div className="flex justify-between gap-2"><dt>Skipped</dt><dd className="tabular-nums">{source.skipped.reduce((sum, item) => sum + item.count, 0)}</dd></div></dl></li>)}</ul>
      {receipt.sources.some(source => source.generated > 0) ? <p className="text-sm leading-6 text-penny-muted">Generated rows come from supplied bundle metadata, such as a board mapping or CSV author. They are counted separately from rows read from source files.</p> : null}
      {receipt.sources.some(source => source.skipped.length > 0) ? <ul className="space-y-2 text-sm leading-6 text-penny-muted">{receipt.sources.flatMap(source => source.skipped.map(item => <li key={`${source.kind}-${item.reason}`}><span className="font-medium text-penny-ink">{source.kind}: {item.count} skipped.</span> {item.reason}</li>))}</ul> : null}
    </div>

    {receipt.uservoice ? <UserVoiceReceiptSection history={receipt.uservoice}/> : null}

    {receipt.aggregates.length ? <div className="space-y-2">
      <h4 className="font-bold text-penny-ink">Aggregate only</h4>
      <div className="hidden sm:block"><ReceiptTable label="Aggregate only columns">
        <thead><tr className="border-b border-penny-line bg-penny-card text-penny-muted"><th className="w-[34%] break-words px-2 py-2 font-medium sm:px-3" scope="col">Column</th><th className="w-[27%] break-words px-2 py-2 font-medium sm:px-3" scope="col">Type</th><th className="w-[20%] break-words px-2 py-2 font-medium sm:px-3" scope="col">Total</th><th className="w-[19%] break-words px-2 py-2 font-medium sm:px-3" scope="col">Rows</th></tr></thead>
        <tbody>{receipt.aggregates.map((aggregate, index) => <tr key={`${aggregate.field}-${aggregate.category}-${index}`} className="border-b border-penny-line last:border-0"><th className="break-words px-2 py-2 align-top font-medium sm:px-3" scope="row">{aggregate.field}</th><CountCell>{aggregate.category}</CountCell><CountCell>{aggregate.total ?? 'Not summed'}</CountCell><CountCell>{aggregate.rows}</CountCell></tr>)}</tbody>
      </ReceiptTable></div>
      <ul className="space-y-2 sm:hidden">{receipt.aggregates.map((aggregate, index) => <li key={`${aggregate.field}-${aggregate.category}-${index}`} className="rounded-lg border border-penny-line p-3"><h5 className="break-words font-bold">{aggregate.field}</h5><dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><div className="flex justify-between gap-2"><dt>Type</dt><dd className="break-words">{aggregate.category}</dd></div><div className="flex justify-between gap-2"><dt>Total</dt><dd className="break-words tabular-nums">{aggregate.total ?? 'Not summed'}</dd></div><div className="flex justify-between gap-2"><dt>Rows</dt><dd className="tabular-nums">{aggregate.rows}</dd></div></dl></li>)}</ul>
      <p className="text-sm leading-6 text-penny-muted">These values stay as aggregates. No voter, commenter, account or revenue records are created from them.</p>
    </div> : null}

    <div className="space-y-2">
      <h4 className="font-bold text-penny-ink">Destination rows by table</h4>
      <div className="hidden sm:block"><ReceiptTable label="Destination row counts by table">
        <thead><tr className="border-b border-penny-line bg-penny-card text-penny-muted"><th className="w-[28%] break-words px-2 py-2 font-medium sm:px-3" scope="col">Table</th><th className="w-[18%] break-words px-2 py-2 font-medium sm:px-3" scope="col">Planned</th><th className="w-[18%] break-words px-2 py-2 font-medium sm:px-3" scope="col">Created</th><th className="w-[18%] break-words px-2 py-2 font-medium sm:px-3" scope="col">Removed</th><th className="w-[18%] break-words px-2 py-2 font-medium sm:px-3" scope="col">Kept</th></tr></thead>
        <tbody>{receipt.destinations.map(destination => <tr key={destination.table} className="border-b border-penny-line last:border-0"><th className="break-words px-2 py-2 align-top font-medium sm:px-3" scope="row">{destination.table}</th><CountCell>{destination.planned}</CountCell><CountCell>{destination.created}</CountCell><CountCell>{destination.removed}</CountCell><CountCell>{destination.retained}</CountCell></tr>)}</tbody>
      </ReceiptTable></div>
      <ul className="space-y-2 sm:hidden">{receipt.destinations.map(destination => <li key={destination.table} className="rounded-lg border border-penny-line p-3"><h5 className="break-words font-bold">{destination.table}</h5><dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><div className="flex justify-between gap-2"><dt>Planned</dt><dd className="tabular-nums">{destination.planned}</dd></div><div className="flex justify-between gap-2"><dt>Created</dt><dd className="tabular-nums">{destination.created}</dd></div><div className="flex justify-between gap-2"><dt>Removed</dt><dd className="tabular-nums">{destination.removed}</dd></div><div className="flex justify-between gap-2"><dt>Kept</dt><dd className="tabular-nums">{destination.retained}</dd></div></dl></li>)}</ul>
    </div>

    {receipt.omissions.length ? <div className="space-y-2"><h4 className="font-bold text-penny-ink">Omissions ({receipt.omissions.length})</h4><ReceiptPages items={receipt.omissions} label="omissions" render={item => <><span className="font-medium">{item.kind} · {item.field} · {item.count}</span><span className="text-penny-muted"> — {item.reason}</span></>}/></div> : null}

    {receipt.unresolved.length ? <div className="space-y-2"><h4 className="font-bold text-penny-ink">Unresolved relationships ({receipt.unresolved.length})</h4><ReceiptPages items={receipt.unresolved} label="relationships" render={item => <><span className="font-medium">{item.kind} · {item.sourceId}</span><span className="text-penny-muted"> — {item.field} points to {item.target}; it was not guessed.</span></>}/></div> : null}

    <div className="space-y-2"><h4 className="font-bold text-penny-ink">Historical identity</h4><ul className="space-y-2 text-sm leading-6">{receipt.identities.map(identity => <li key={identity.kind}><span className="font-medium">{identity.kind}:</span> {identity.treatment}</li>)}</ul><p className="text-sm leading-6 text-penny-muted">Missing author details stay unknown. No requester or initial submission is invented from an aggregate row.</p></div>

    <div className="space-y-2"><h4 className="font-bold text-penny-ink">External effects</h4><dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><div className="flex justify-between gap-2"><dt>Mail outbox rows</dt><dd className="tabular-nums">{receipt.effects.mail}</dd></div><div className="flex justify-between gap-2"><dt>Notification rows</dt><dd className="tabular-nums">{receipt.effects.notifications}</dd></div></dl></div>

    {receipt.conflicts.length ? <div className="space-y-2" role="status"><h4 className="font-bold text-penny-ink">Kept because native work depends on it ({receipt.conflicts.length})</h4><ReceiptPages items={receipt.conflicts} label="conflicts" render={conflict => <><span className="font-medium">{conflict.kind} · {conflict.sourceId}</span><span className="text-penny-muted"> — {conflict.reason}</span></>}/></div> : null}
    <p className="text-sm leading-6 text-penny-muted">{receipt.originalsRetained ? 'The private source originals are retained.' : 'The private source originals are no longer retained.'}</p>
  </section>
}

export function JobReceiptPanel({ jobId }: { jobId: string }) {
  const [resource, retry] = useOperatorResource<ImportReceipt>(`/api/operator/feedback-import/jobs/${encodeURIComponent(jobId)}/receipt`)
  if (resource.kind === 'loading') return <OperatorResourceLoading label="Loading move-in receipt…"/>
  if (resource.kind === 'session_expired') return <OperatorSessionExpired/>
  if (resource.kind === 'not_found') return <OperatorResourceNotFound title="Move-in receipt unavailable">This saved import no longer has a readable receipt.</OperatorResourceNotFound>
  if (resource.kind === 'error') return <OperatorResourceFailure title="Move-in receipt could not be loaded." status={resource.status} message={resource.message} onRetry={retry}/>
  return <div className="rounded-lg border border-penny-line p-4 sm:p-5"><ReceiptContent receipt={resource.data} title="Move-in receipt"/><button type="button" className={`${secondaryButtonClass} mt-4`} onClick={retry}>Refresh receipt</button></div>
}
