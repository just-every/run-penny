import { useState } from 'react'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { dangerButtonClass, disclosureChevronClass, fieldLabelClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { AuditCopyChoices } from './audit-copy-choices'
import { BlockedCopies } from './blocked-copies'
import { DataActionError, auditCopyId, choicesComplete, copyId, entityLabels, mutate, previewErasure, type AuditChoices, type CopyChoices, type Overview, type Plan, type Receipt } from './data-actions'
import { RepeatedWords } from './repeated-words'
import { byPlainName } from './record-words'
import { card, heading, lede, type DataPageActions } from './data-page-parts'

/** Choose a record by name, review everything erasure removes, then erase it. */
export function ErasureCard({ overview, actions, unavailable, onErasing }: { overview: Overview; actions: DataPageActions; unavailable: boolean; onErasing: (receipt: Receipt) => Promise<void> }) {
  const { perform } = actions
  const [plan, setPlan] = useState<Plan | null>(null), [target, setTarget] = useState(''), [auditChoices, setAuditChoices] = useState<AuditChoices>({}), [copyChoices, setCopyChoices] = useState<CopyChoices>({})
  const blocked = plan?.blockedCopies.some(copy => !copy.resolvable), operator = plan?.table === 'operators'
  const ready = !!plan && (operator ? plan.blockedCopies.every(copy => auditChoices[auditCopyId(copy)]) : choicesComplete(plan.blockedCopies, copyChoices))
  return <details className={`group ${card}`}><summary className={`${disclosureChevronClass} ${heading}`}>Erase personal data</summary><p className={lede}>Choose a person, request, evidence item or account by name. Penny shows everything erasure removes before anything is deleted. Protected operator identities cannot be erased here.</p>
    <form className="mt-4 space-y-4" onSubmit={event => {
      event.preventDefault(); void perform('Checking dependent records and original files…', async () => {
        const selected = overview.targets.find(item => `${item.table}:${item.id}` === target)
        if (!selected) throw new Error('Choose a record first.')
        setPlan(await previewErasure(selected.table, selected.id)); setAuditChoices({}); setCopyChoices({})
      })
    }}><label className={fieldLabelClass}>Record<select className={fieldClass} required value={target} disabled={unavailable} onChange={event => { setTarget(event.target.value); setPlan(null) }}><option value="">Choose a record</option>{Object.entries(entityLabels).map(([table, label]) => <optgroup key={table} label={label}>{overview.targets.filter(item => item.table === table).map(item => <option key={item.id} value={`${table}:${item.id}`}>{item.label} · {item.id.slice(-8)}</option>)}</optgroup>)}</select></label><button className={secondaryButtonClass} disabled={unavailable}>Preview erasure</button></form>
    {plan ? <div className="mt-5 border-t border-penny-line pt-5"><h3 className="font-bold text-penny-ink">Confirm permanent erasure</h3><p className="mt-3 break-words text-base font-bold text-penny-ink">{overview.targets.find(item => item.table === plan.table && item.id === plan.id)?.label ?? 'Selected record'}</p><p className="mt-2 text-sm text-penny-muted">{entityLabels[plan.table]}</p><p className="mt-4 text-sm font-semibold text-penny-ink">Removed</p><dl className="mt-2 grid gap-x-8 gap-y-2 text-sm text-penny-ink sm:grid-cols-2">{byPlainName(Object.entries(plan.counts).map(([table, count]) => ({ table, counts: { count } }))).map(({ name, counts }) => <div key={name} className="flex min-w-0 justify-between gap-3"><dt className="break-words">{name}</dt><dd className="shrink-0 font-bold tabular-nums">{counts.count}</dd></div>)}</dl><p className="mt-3 text-sm text-penny-ink">Original files to delete: {plan.fileCount}.</p>{plan.importCount ? <p className="mt-3 text-sm leading-6 text-penny-ink">The saved original {plan.importCount === 1 ? 'file of 1 import' : `files of ${plan.importCount} imports`} will also be withdrawn, for everyone in {plan.importCount === 1 ? 'that import' : 'those imports'}. Imported records of other people are kept.</p> : null}
      {plan.table === 'requesters' && plan.kept?.requests ? <p className="mt-3 text-sm leading-6 text-penny-ink">This person created {plan.kept.requests === 1 ? 'a request' : `${plan.kept.requests} requests`}. {plan.kept.requests === 1 ? 'It stays' : 'They stay'} for everyone else, without this person’s name or words: other people’s votes, comments and evidence on {plan.kept.requests === 1 ? 'it' : 'them'}, and the decisions {plan.kept.requests === 1 ? 'it supports' : 'they support'}, are kept.</p> : null}
      {plan.kept && Object.keys(plan.kept).length ? <><p className="mt-4 text-sm font-semibold text-penny-ink">Kept, with this person’s words removed</p><dl className="mt-2 grid gap-x-8 gap-y-2 text-sm text-penny-ink sm:grid-cols-2">{byPlainName(Object.entries(plan.kept).map(([table, count]) => ({ table, counts: { count } }))).map(({ name, counts }) => <div key={name} className="flex min-w-0 justify-between gap-3"><dt className="break-words">{name}</dt><dd className="shrink-0 font-bold tabular-nums">{counts.count}</dd></div>)}</dl></> : null}
      {blocked ? <BlockedCopies copies={plan.blockedCopies} /> : <><p className="mt-4 text-sm leading-6 text-penny-ink">This permanently removes the reviewed records and files. Retained audit references are anonymized.</p>{plan.blockedCopies.length ? operator ? <AuditCopyChoices copies={plan.blockedCopies} value={auditChoices} onChange={setAuditChoices} disabled={unavailable} /> : <RepeatedWords copies={plan.blockedCopies} value={copyChoices} onChange={setCopyChoices} disabled={unavailable} /> : null}<button className={dangerButtonClass + ' mt-4'} disabled={unavailable || !ready} onClick={() => void perform('Erasing the reviewed records and original files. Penny finishes this on the server, so you can close this page.', async () => {
        const choices = plan.blockedCopies.length ? operator ? { auditCopies: plan.blockedCopies.map(copy => ({ id: auditCopyId(copy), resolution: auditChoices[auditCopyId(copy)] })) } : { copies: plan.blockedCopies.map(copy => ({ table: copy.table, key: copy.key, ...copyChoices[copyId(copy)] })) } : {}
        const result = await mutate<Receipt>('erasure', { table: plan.table, id: plan.id, planHash: plan.planHash, ...choices }).catch((error: unknown) => { if (error instanceof DataActionError && error.code === 'erasure_plan_changed') setPlan(null); throw error })
        setPlan(null); setTarget('')
        await onErasing(result)
      })}>Permanently erase reviewed data</button></>}
    </div> : null}
    <p className="mt-4 text-sm leading-6 text-penny-muted">The list shows the 100 most recent records for each kind.</p>
  </details>
}
