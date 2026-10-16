import type { BlockedCopy } from './data-actions'
import { recordLabel } from './data-actions'

// Where wording can be repeated, in the words an operator sees in the app.
const places: Record<string, string> = {
  requests: 'Another feedback request', request_comments: 'A comment', request_content_submissions: 'A submitted edit',
  evidence_items: 'An evidence item', evidence_versions: 'An evidence item’s wording', roadmap_items: 'A roadmap item',
  roadmap_publications: 'A roadmap item’s approved public wording', roadmap_transitions: 'A roadmap move reason',
  request_status_updates: 'A status update', release_versions: 'A release', decisions: 'A decision',
  candidate_bets: 'A decision bet', accounts: 'An account', audit_entries: 'The audit history', requesters: 'A person’s record',
}
const column = (name: string) => name.replace(/_json$/, '').replaceAll('_', ' ')

/** A refused erasure (ambiguous_erasure_copies) in plain words: which records repeat the wording and what to do. */
export function BlockedCopies({ copies }: { copies: BlockedCopy[] }) {
  const blocked = copies.filter(copy => !copy.resolvable), auditOnly = blocked.every(copy => copy.table === 'audit_entries'), person = blocked.some(copy => copy.table === 'requesters')
  return <div role="alert" className="mt-4 rounded-lg border border-penny-danger p-4 text-sm leading-6 text-penny-ink">
    <p className="font-semibold">Penny can’t erase this yet. {blocked.length === 1 ? 'One other record repeats' : `${blocked.length} other records repeat`} its wording, and Penny can’t tell whether those words came from this person.</p>
    <ul className="mt-2 list-disc pl-5">{blocked.map(copy => <li key={copy.table + copy.key} className="break-words">{places[copy.table] ?? recordLabel(copy.table)} ({copy.columns.map(column).join(', ')})</li>)}</ul>
    {person ? <p className="mt-2">The person who wrote it is named in it. To remove both, erase the person instead: choose them under Requesters. That also erases every request they created.</p> : null}
    <p className="mt-2">{auditOnly
      ? 'Only the audit history repeats it. The audit history can’t be edited, so this record can’t be erased from the app.'
      : `${person ? 'Otherwise, open' : 'Open'} each record listed, reword or remove the repeated text (or erase that record first), then choose Preview erasure again.`}</p>
  </div>
}
