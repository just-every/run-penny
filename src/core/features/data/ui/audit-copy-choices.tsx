import { fieldClass } from '@/core/features/auth/client-mutations'
import { fieldLabelClass } from '@/core/ui/app/classes'
import { auditCopyId, type AuditChoices, type BlockedCopy } from './data-actions'

/** Name-only audit rows: someone else's record that repeats the person's display
 * name. The owner decides each one before erasing; the choice is audited. */
export function AuditCopyChoices({ copies, value, onChange, disabled }: { copies: BlockedCopy[]; value: AuditChoices; onChange: (next: AuditChoices) => void; disabled: boolean }) {
  return <fieldset className="mt-4 space-y-3"><legend className="text-sm leading-6 font-semibold text-penny-ink">{copies.length === 1 ? 'An audit entry' : `${copies.length} audit entries`} by someone else repeat this person's name. Decide each before erasing.</legend>
    {copies.map(copy => { const id = auditCopyId(copy); return <label key={id} className={fieldLabelClass}>
      <span className="block break-words">{copy.action} · {copy.occurredAt ? new Date(copy.occurredAt).toLocaleString() : 'time unknown'}</span>
      <select className={fieldClass} required disabled={disabled} value={value[id] ?? ''} onChange={event => onChange({ ...value, [id]: event.target.value as 'unrelated' | 'clear' })}>
        <option value="">Choose</option><option value="unrelated">Unrelated: keep unchanged</option><option value="clear">Clear its details</option>
      </select></label> })}
  </fieldset>
}
