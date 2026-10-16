import { useState } from 'react'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { fieldLabelClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { operatorMutation } from './operator-client'

export interface InternalNote { id: string; body: string; created_at: string; operator_display_name: string | null; receiver_name: string | null }

/** Operator-only notes on a request: written here by a teammate, or sent by
 * another tool through a signed internal-note receiver (Settings → Webhook and
 * Slack connections). Never public. */
export function InternalNotes({ slug, notes, onSaved }: { slug: string; notes: readonly InternalNote[]; onSaved: () => void }) {
  const [body, setBody] = useState(''), [error, setError] = useState('')
  return <section className="mt-5 border-t border-penny-line pt-4" aria-label="Internal notes">
    <h3 className="font-bold text-penny-ink">Internal notes{notes.length ? ` (${notes.length})` : ''}</h3>
    {notes.length ? <ul className="mt-2 max-w-3xl divide-y divide-penny-line text-sm">{notes.map(note => <li key={note.id} className="space-y-1 py-2">
      <p className="text-penny-muted">{note.receiver_name ? <>Sent by <span className="font-semibold text-penny-ink">{note.receiver_name}</span> (signed receiver)</> : <span className="font-semibold text-penny-ink">{note.operator_display_name ?? 'An operator'}</span>} · <time dateTime={note.created_at}>{new Date(note.created_at).toLocaleString()}</time></p>
      <p className="leading-6 break-words whitespace-pre-wrap text-penny-ink">{note.body}</p>
    </li>)}</ul> : <p className="mt-2 text-sm text-penny-muted">No internal notes yet. Notes your other tools send through a signed receiver appear here too.</p>}
    <form className="mt-3 max-w-3xl space-y-2" onSubmit={event => { event.preventDefault(); setError(''); void operatorMutation(`/api/operator/requests/${slug}/notes`, { body }).then(() => { setBody(''); onSaved() }, (reason: unknown) => setError(reason instanceof Error ? reason.message : 'The note was not saved.')) }}>
      <label className={fieldLabelClass}>Add an internal note<textarea className={fieldClass} required value={body} onChange={event => setBody(event.target.value)} /></label>
      <button className={secondaryButtonClass}>Save note</button>
      {error ? <p role="alert" className="text-sm font-semibold text-penny-danger">{error}</p> : null}
    </form>
  </section>
}
