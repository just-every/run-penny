import { fieldClass } from '@/core/features/auth/client-mutations'
import { choicePillClass, fieldLabelClass, insetPanelClass, textLinkClass } from '@/core/ui/app/classes'
import { copyId, type BlockedCopy, type CopyChoice, type CopyChoices } from './data-actions'
import { places } from './record-words'

const columns: Record<string, string> = { title: 'Title', public_title: 'Public title', public_description: 'Public description', summary: 'Summary', public_summary: 'Public summary', note: 'Note', wording: 'Wording', body: 'Text', question: 'Question', rationale: 'Rationale', reason: 'Reason', description: 'Description', name: 'Name' }
const column = (name: string) => columns[name] ?? name.replace(/_json$/, '').replaceAll('_', ' ')

/** Penny's own records that repeat the person's words: the owner opens each one,
 * then removes the repeated words in place or gives it a new name, before erasing. */
export function RepeatedWords({ copies, value, onChange, disabled }: { copies: BlockedCopy[]; value: CopyChoices; onChange: (next: CopyChoices) => void; disabled: boolean }) {
  const set = (copy: BlockedCopy, choice: CopyChoice) => onChange({ ...value, [copyId(copy)]: choice })
  return <fieldset className="mt-4 space-y-4"><legend className="text-sm leading-6 font-semibold text-penny-ink">{copies.length === 1 ? 'One of Penny’s records repeats' : `${copies.length} of Penny’s records repeat`} this person’s words. Open each one if you need to, then choose what happens to the repeated words.</legend>
    {copies.map(copy => {
      const id = copyId(copy), choice = value[id], name = `repeat-${id}`
      return <div key={id} className={`${insetPanelClass} space-y-3 p-4`}>
        <p className="text-sm font-semibold break-words text-penny-ink">{places[copy.table] ?? 'A linked record'}{copy.label ? <>: {copy.href ? <a className={textLinkClass} href={copy.href} target="_blank" rel="noreferrer">{copy.label}</a> : copy.label}</> : null}</p>
        <dl className="space-y-1 text-sm leading-6 text-penny-ink">{copy.columns.map(name => <div key={name} className="break-words"><dt className="inline font-semibold">{column(name)}: </dt><dd className="inline">“{copy.values?.[name]?.current}”</dd></div>)}</dl>
        <div className="flex flex-wrap gap-2">
          <label className={choicePillClass}><input type="radio" name={name} disabled={disabled} checked={choice?.resolution === 'redact'} onChange={() => set(copy, { resolution: 'redact' })} />Remove the repeated words</label>
          <label className={choicePillClass}><input type="radio" name={name} disabled={disabled} checked={choice?.resolution === 'rename'} onChange={() => set(copy, { resolution: 'rename', values: Object.fromEntries(copy.columns.map(name => [name, ''])) })} />Rename</label>
        </div>
        {choice?.resolution === 'redact' ? <p className="text-sm leading-6 break-words text-penny-muted">{copy.columns.map(name => `${column(name)} becomes “${copy.values?.[name]?.redacted}”`).join('. ')}.</p> : null}
        {choice?.resolution === 'rename' ? copy.columns.map(name => <label key={name} className={fieldLabelClass}>New {column(name).toLowerCase()}<input className={fieldClass} required disabled={disabled} value={choice.values?.[name] ?? ''} onChange={event => set(copy, { resolution: 'rename', values: { ...choice.values, [name]: event.target.value } })} /></label>) : null}
      </div>
    })}
    <p className="text-sm leading-6 text-penny-muted">Release notes and status updates that were already published keep the wording they were published with.</p>
  </fieldset>
}
