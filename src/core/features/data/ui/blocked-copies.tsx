import { textLinkClass } from '@/core/ui/app/classes'
import type { BlockedCopy } from './data-actions'
import { places } from './record-words'

const column = (name: string) => name.replace(/_json$/, '').replaceAll('_', ' ')

/** A refused erasure (ambiguous_erasure_copies) in plain words: which records repeat the wording and what to do. */
export function BlockedCopies({ copies }: { copies: BlockedCopy[] }) {
  const blocked = copies.filter(copy => !copy.resolvable), auditOnly = blocked.every(copy => copy.table === 'audit_entries'), person = blocked.some(copy => copy.table === 'requesters')
  return <div role="alert" className="mt-4 rounded-lg border border-penny-danger p-4 text-sm leading-6 text-penny-ink">
    <p className="font-semibold">Penny can’t erase this yet. {blocked.length === 1 ? 'One other record repeats' : `${blocked.length} other records repeat`} its wording, and Penny can’t tell whether those words came from this person.</p>
    <ul className="mt-2 list-disc pl-5">{blocked.map(copy => <li key={copy.table + copy.key} className="break-words">{places[copy.table] ?? 'Another linked record'}{copy.label ? <>: {copy.href ? <a className={textLinkClass} href={copy.href} target="_blank" rel="noreferrer">{copy.label}</a> : copy.label}</> : null} ({copy.columns.map(column).join(', ')})</li>)}</ul>
    {person ? <p className="mt-2">The person who wrote it is named in it. To remove both, erase the person instead: choose them under Requesters. Their requests stay for everyone else, without their name or words.</p> : null}
    <p className="mt-2">{auditOnly
      ? 'Only the audit history repeats it. The audit history can’t be edited, so this record can’t be erased from the app.'
      : `${person ? 'Otherwise, open' : 'Open'} each record listed, reword or remove the repeated text (or erase that record first), then choose Preview erasure again.`}</p>
  </div>
}
