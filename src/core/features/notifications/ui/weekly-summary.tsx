import { useEffect, useId, useState } from 'react'
import { requesterHeaders } from '@/core/features/auth/client-mutations'
import { PublicCard } from '@/core/features/portal/ui/public-primitives'
import { secondaryButtonClass, textLinkClass } from '@/core/ui/app/classes'
import { checkboxClass, checkRowClass } from '@/core/features/requests/ui/form-classes'

interface WeeklyPermission {
  enabled: boolean
  subscribed: boolean
  origin: 'choice' | 'vote' | 'none'
  grantedAt: string | null
}
const path = '/api/public/requester/weekly-summary'

export function WeeklySummary() {
  const heading = useId(), description = useId()
  const [permission, setPermission] = useState<WeeklyPermission | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'expired' | 'error'>('loading')
  const [attempt, retry] = useState(0), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  useEffect(() => {
    const changed = () => retry(value => value + 1)
    window.addEventListener('penny-requester-changed', changed)
    return () => window.removeEventListener('penny-requester-changed', changed)
  }, [])
  useEffect(() => {
    const controller = new AbortController(), headers = requesterHeaders()
    if (!Object.keys(headers).length) { setState('expired'); return }
    setState('loading')
    void fetch(path, { headers, signal: controller.signal }).then(async response => {
      if (response.status === 401) { setState('expired'); return }
      if (!response.ok) throw new Error()
      const data = await response.json() as WeeklyPermission
      if (!controller.signal.aborted) { setPermission(data); setState('ready') }
    }).catch(() => { if (!controller.signal.aborted) setState('error') })
    return () => controller.abort()
  }, [attempt])

  async function save(subscribed: boolean) {
    setBusy(true); setMessage('')
    try {
      const response = await fetch(path, { method: 'PATCH', headers: { ...requesterHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ subscribed }) })
      if (response.status === 401) { setState('expired'); return }
      if (!response.ok) {
        const result = await response.json() as { message?: string }
        throw new Error(result.message ?? 'Could not save your weekly summary choice. Try again.')
      }
      setPermission(await response.json() as WeeklyPermission)
      setMessage(subscribed ? 'Weekly summary enabled.' : 'Weekly summary stopped. Your other email choices, follows and votes are unchanged.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save your weekly summary choice.') }
    finally { setBusy(false) }
  }

  return <PublicCard className="mt-6 p-5">
    <section aria-labelledby={heading}>
      <h2 id={heading} className="font-bold text-penny-ink">Weekly summary</h2>
      {state === 'loading' ? <p role="status" className="mt-3 text-sm">Loading weekly summary choice…</p> : null}
      {state === 'expired' ? <p className="mt-3 text-sm"><a href="/portal/feedback/new" className={textLinkClass}>Verify your email</a> to choose a weekly summary.</p> : null}
      {state === 'error' ? <div className="mt-3 text-sm"><p role="alert">Your weekly summary choice could not be loaded.</p><button className={`${secondaryButtonClass} mt-3`} onClick={() => retry(value => value + 1)}>Retry weekly summary</button></div> : null}
      {state === 'ready' && permission ? <>
        <p id={description} className="mt-3 text-sm leading-6 text-penny-muted">{permission.origin === 'vote'
          ? 'Your vote subscription includes a weekly summary of public changes to the requests covered by that permission.'
          : 'Get one email a week with public changes to requests you follow and published product releases. Empty weeks send no summary.'}</p>
        {!permission.enabled ? <p className="mt-3 text-sm text-penny-muted">The workspace owner has turned weekly summaries off. {permission.subscribed ? 'You can still turn off your weekly summary choice.' : 'You can opt in when the owner enables them.'}</p> : null}
        <label className={`${checkRowClass} mt-4`}>
          <input type="checkbox" className={checkboxClass} checked={permission.subscribed} disabled={busy || (!permission.enabled && !permission.subscribed)} aria-describedby={description} onChange={event => void save(event.target.checked)} />
          Email me a weekly summary
        </label>
        <p className="mt-2 text-sm text-penny-muted">Turning this off keeps your other email choices, follows and votes.</p>
      </> : null}
      <p role="status" className="mt-3 text-sm empty:hidden">{busy ? 'Saving weekly summary choice…' : message}</p>
    </section>
  </PublicCard>
}
