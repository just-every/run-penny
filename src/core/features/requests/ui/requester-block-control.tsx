import { useId, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import type { OperatorRequesterCard } from '@/core/features/workspace/paged-service'
import { Chip } from '@/core/ui/app/Chip'
import { insetPanelClass, primaryButtonClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { operatorMutation } from './operator-client'

export function RequesterBlockControl({ requester, onSaved }: {
  requester: OperatorRequesterCard
  onSaved: () => void
}) {
  const router = useRouter(), confirmationId = useId()
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(''), [failed, setFailed] = useState(false)
  const blocked = requester.blockedAt !== null
  const action = blocked ? 'Unblock requester' : 'Block requester'

  async function save() {
    if (busy) return
    const nextBlocked = !blocked
    setBusy(true)
    setMessage('')
    setFailed(false)
    try {
      await operatorMutation(`/api/operator/requesters/${encodeURIComponent(requester.id)}/block`, {}, nextBlocked ? 'POST' : 'DELETE')
    } catch (error) {
      setFailed(true)
      setMessage(error instanceof Error ? error.message : 'Could not change requester access. Try again.')
      setBusy(false)
      return
    }
    const success = nextBlocked ? 'Requester blocked.' : 'Requester unblocked.'
    setConfirming(false)
    setMessage(success)
    onSaved()
    try {
      await router.invalidate()
    } catch {
      setMessage(`${success} Could not refresh related pages. Reload to see current data.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 space-y-3" role="group" aria-label={`Requester access for ${requester.displayName}`} aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-3">
        {blocked ? <Chip tone="muted">Blocked</Chip> : null}
        <button type="button" className={secondaryButtonClass} disabled={busy} aria-expanded={confirming} aria-controls={confirmationId} onClick={() => { setConfirming(!confirming); setMessage('') }}>{action}</button>
      </div>
        <div id={confirmationId} hidden={!confirming} className={`${insetPanelClass} space-y-3 p-4`}>
          <p id={`${confirmationId}-consequence`} className="text-sm leading-6 text-penny-ink">
            {blocked
              ? 'Unblocking restores this requester’s ability to submit, vote, comment, follow and respond to outcomes. Their published requests and comments become visible again, and their votes count again.'
              : 'Blocking refuses this requester’s submissions, votes, comments, follows and outcome responses. Their published requests and comments are hidden from the portal, and their votes stop counting. Private records stay available to operators. Unblocking restores visibility and votes.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={primaryButtonClass} disabled={busy} aria-describedby={`${confirmationId}-consequence`} onClick={() => void save()}>{busy ? 'Saving…' : `Confirm ${action.toLowerCase()}`}</button>
            <button type="button" className={secondaryButtonClass} disabled={busy} onClick={() => { setConfirming(false); setMessage('') }}>Cancel</button>
          </div>
        </div>
      {message ? <p role={failed ? 'alert' : 'status'} className={`break-words text-sm ${failed ? 'text-penny-danger' : 'text-penny-ink'}`}>{message}</p> : null}
    </div>
  )
}
