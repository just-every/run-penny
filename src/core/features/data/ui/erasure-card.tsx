import { useState } from 'react'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { dangerButtonClass, disclosureChevronClass, fieldLabelClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { AuditCopyChoices } from './audit-copy-choices'
import { BlockedCopies } from './blocked-copies'
import { DataActionError, auditCopyId, entityLabels, mutate, previewErasure, recordLabel, type AuditChoices, type Overview, type Plan, type Receipt } from './data-actions'
import { card, heading, lede, type DataPageActions } from './data-page-parts'

/** Choose a record by name, review everything erasure removes, then erase it. */
export function ErasureCard({ overview, actions, unavailable, onErasing }: { overview: Overview; actions: DataPageActions; unavailable: boolean; onErasing: (receipt: Receipt) => Promise<void> }) {
  const { perform } = actions
  const [plan, setPlan] = useState<Plan | null>(null), [target, setTarget] = useState(''), [auditChoices, setAuditChoices] = useState<AuditChoices>({})
  const blocked = plan?.blockedCopies.some(copy => !copy.resolvable)
  return <details className={`group ${card}`}><summary className={`${disclosureChevronClass} ${heading}`}>Erase personal data</summary><p className={lede}>Choose a person, request, evidence item or account by name. Penny shows everything erasure removes before anything is deleted. Protected operator identities cannot be erased here.</p>
    <form className="mt-4 space-y-4" onSubmit={event => {
      event.preventDefault(); void perform('Checking dependent records and original files…', async () => {
        const selected = overview.targets.find(item => `${item.table}:${item.id}` === target)
        if (!selected) throw new Error('Choose a record first.')
        setPlan(await previewErasure(selected.table, selected.id)); setAuditChoices({})
      })
    }}><label className={fieldLabelClass}>Record<select className={fieldClass} required value={target} disabled={unavailable} onChange={event => { setTarget(event.target.value); setPlan(null) }}><option value="">Choose a record</option>{Object.entries(entityLabels).map(([table, label]) => <optgroup key={table} label={label}>{overview.targets.filter(item => item.table === table).map(item => <option key={item.id} value={`${table}:${item.id}`}>{item.label} · {item.id.slice(-8)}</option>)}</optgroup>)}</select></label><button className={secondaryButtonClass} disabled={unavailable}>Preview erasure</button></form>
    {plan ? <div className="mt-5 border-t border-penny-line pt-5"><h3 className="font-bold text-penny-ink">Confirm permanent erasure</h3><p className="mt-3 break-words text-base font-bold text-penny-ink">{overview.targets.find(item => item.table === plan.table && item.id === plan.id)?.label ?? 'Selected record'}</p><p className="mt-2 break-all text-sm text-penny-muted">{entityLabels[plan.table]} · {plan.id}</p><dl className="mt-4 grid gap-x-8 gap-y-2 text-sm text-penny-ink sm:grid-cols-2">{Object.entries(plan.counts).map(([table, count]) => <div key={table} className="flex min-w-0 justify-between gap-3"><dt className="break-words">{recordLabel(table)}</dt><dd className="shrink-0 font-bold tabular-nums">{count}</dd></div>)}</dl><p className="mt-3 text-sm text-penny-ink">Original files to delete: {plan.fileCount}.</p>{plan.importCount ? <p className="mt-3 text-sm leading-6 text-penny-ink">The saved original {plan.importCount === 1 ? 'file of 1 import' : `files of ${plan.importCount} imports`} will also be withdrawn, for everyone in {plan.importCount === 1 ? 'that import' : 'those imports'}. Imported records of other people are kept.</p> : null}
      {plan.table === 'requesters' && plan.counts.requests ? <p className="mt-3 text-sm leading-6 text-penny-ink">This person created {plan.counts.requests === 1 ? 'a request' : `${plan.counts.requests} requests`}. Erasing them also removes {plan.counts.requests === 1 ? 'it' : 'those requests'} and every vote and comment other people added to {plan.counts.requests === 1 ? 'it' : 'them'}.</p> : null}
      {blocked ? <BlockedCopies copies={plan.blockedCopies} /> : <><p className="mt-4 text-sm leading-6 text-penny-ink">This permanently removes the reviewed records and files. Retained audit references are anonymized.</p>{plan.blockedCopies.length ? <AuditCopyChoices copies={plan.blockedCopies} value={auditChoices} onChange={setAuditChoices} disabled={unavailable} /> : null}<button className={dangerButtonClass + ' mt-4'} disabled={unavailable || plan.blockedCopies.some(copy => !auditChoices[auditCopyId(copy)])} onClick={() => void perform('Erasing the reviewed records and original files…', async () => {
        const result = await mutate<Receipt>('erasure', { table: plan.table, id: plan.id, planHash: plan.planHash, ...(plan.blockedCopies.length ? { auditCopies: plan.blockedCopies.map(copy => ({ id: auditCopyId(copy), resolution: auditChoices[auditCopyId(copy)] })) } : {}) }).catch((error: unknown) => { if (error instanceof DataActionError && error.code === 'erasure_plan_changed') setPlan(null); throw error })
        setPlan(null); setTarget('')
        await onErasing(result)
      })}>Permanently erase reviewed data</button></>}
    </div> : null}
    <p className="mt-4 text-sm leading-6 text-penny-muted">The list shows the 100 most recent records for each kind.</p>
  </details>
}
