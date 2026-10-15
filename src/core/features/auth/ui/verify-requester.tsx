import { useState } from 'react'
import { takeReturn } from '@/core/features/auth/requester-return'
import { Link } from '@tanstack/react-router'
import { postJson, requesterStorageKey } from '@/core/features/auth/client-mutations'
import { buttonClass, textLinkClass } from '@/core/features/portal/ui/portal-classes'
import { PageTitle } from '@/core/ui/app/PageTitle'
import { PublicPortalLayout, type PublicPortalContent } from '@/core/features/portal/ui/public-portal-layout'
import { PublicCard } from '@/core/features/portal/ui/public-primitives'

export function VerifyRequester({ content }: { readonly content: PublicPortalContent }) {
  const [message, setMessage] = useState(''), [verified, setVerified] = useState(false), [busy, setBusy] = useState(false), [back, setBack] = useState<string | null>(null)
  async function verify() {
    const token = new URLSearchParams(location.hash.slice(1)).get('token')
    setBusy(true)
    try {
      const result = await postJson<{ token: string; rejectedPendingActions: number }>('/api/public/identity/email/verify', { token })
      localStorage.setItem(requesterStorageKey, result.token)
      history.replaceState(null, '', location.pathname)
      setBack(takeReturn()); setVerified(true)
      setMessage(result.rejectedPendingActions ? 'Email verified. Some earlier actions could not be applied because the feedback changed. Other valid actions were saved.' : 'Email verified.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Verification failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <PublicPortalLayout content={content}>
      <div className="mx-auto max-w-2xl py-2 sm:py-6">
        <PageTitle id="verify-heading" eyebrow="Feedback">Verify your email</PageTitle>
        <PublicCard className="mt-8 p-5 sm:p-7">
          <p className="leading-7 text-penny-ink">Continue to verify your email and create this browser’s requester session. This does not subscribe you to email updates.</p>
          {!verified
            ? <button className={`${buttonClass} mt-5`} disabled={busy} onClick={() => void verify()}>{busy ? 'Verifying…' : 'Verify email'}</button>
            : back ? <div className="mt-5 flex flex-wrap items-center gap-4"><a href={back} className={buttonClass}>Back to the feedback you were reading</a><Link to="/portal/feedback/new" className={textLinkClass}>Submit new feedback</Link></div>
            : <Link to="/portal/feedback/new" className={`${buttonClass} mt-5`}>Continue to submit feedback</Link>}
          <p role="status" className="mt-4 text-sm leading-6 text-penny-ink">{message}</p>
        </PublicCard>
        <Link to="/portal/feedback/new" className={`${textLinkClass} mt-6 inline-flex min-h-11 items-center text-sm`}>Request a new verification link</Link>
      </div>
    </PublicPortalLayout>
  )
}
