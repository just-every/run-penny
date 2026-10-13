import { HydrationUnit } from '@/base/hydration/unit'
import { useEffect, useState } from 'react'
import branding from '@/branding.json'
import { Link } from '@tanstack/react-router'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import { BrandRoot } from '@/core/ui/app/BrandRoot'
import { eyebrowClass, fieldLabelClass, paperCardClass, textLinkClass } from '@/core/ui/app/classes'
import { SignInArtBottom, SignInArtTop, SignInArtWide } from '@/core/ui/app/collage/SignInArt'
import { PageTitle } from '@/core/ui/app/PageTitle'
import { CoinMark } from '@/core/ui/brand/CoinMark'
import { buttonClass, fieldClass, postJson } from '../client-mutations'
export function SignInShell() {
  const [hydrated,setHydrated]=useState(false)
  useEffect(()=>setHydrated(true),[])
  const [capabilities] = usePublicResource<{ transport: string }>('/api/auth/capabilities')
  const ready = capabilities.kind === 'ready' && capabilities.data.transport !== 'unavailable'
  const [admission] = usePublicResource<{ authenticated: boolean }>('/api/auth/session')
  const session = admission.kind === 'loading' ? 'checking' : admission.kind === 'ready' && admission.data.authenticated ? 'valid' : admission.kind === 'error' && admission.status === 401 ? 'none' : 'error'
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [requested, setRequested] = useState(false)
  return <BrandRoot><main className="grid min-h-svh place-items-center overflow-x-clip px-4 py-12 sm:px-6"><div className="relative w-full max-w-lg"><HydrationUnit><SignInArtWide /></HydrationUnit><HydrationUnit><SignInArtTop /></HydrationUnit><HydrationUnit><section className={`${paperCardClass} relative z-10 w-full p-7 text-center sm:p-10 [&_.pl-stroke]:mx-auto`}>
    <div className="mb-6 flex justify-center"><CoinMark className="[--coin-slot:3rem]" /></div>
    <p className={eyebrowClass}>Operator access</p>
    <PageTitle size="card" className="mt-3">Sign in to {branding.name}</PageTitle>
    {session === 'checking' ? <p role="status" className="mt-5 text-base">Checking your session…</p> : session === 'valid' ? <><p className="mt-4 text-lg leading-normal text-penny-muted">You are already signed in.</p><Link to="/app" className={buttonClass + ' mt-6 w-full'}>Continue to workspace</Link></> : session === 'error' ? <p role="alert" className="mt-5 text-base leading-normal">Your session could not be checked. Reload this page to try again.</p> : requested ? <>
      <p role="status" className="mt-4 text-lg leading-normal text-penny-muted">If your address is allowed, check your email for a sign-in link.</p>
      <p className="mt-4 text-base text-penny-muted">The link is single-use and expires in 15 minutes.</p><button className={`mt-4 min-h-11 text-base ${textLinkClass}`} onClick={() => { setRequested(false); setMessage('') }}>Use another email</button>
    </> : <>
      <p className="mx-auto mt-4 max-w-sm text-lg leading-normal text-penny-muted">Use your operator email to request a single-use sign-in link.</p>
      {!ready ? <p className="mt-3 text-base">Operator sign-in is temporarily unavailable because email links cannot be sent.</p> : null}
      <form className="mt-6 space-y-5 text-left" onSubmit={async event => {
        event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setMessage('')
        try { await postJson('/api/auth/magic-link', { email: data.get('email'), returnTo: new URLSearchParams(window.location.search).get('returnTo') ?? undefined }); setRequested(true) }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Sign-in failed.') }
        finally { setBusy(false) }
      }}><label className={fieldLabelClass}>Operator email<input className={fieldClass} name="email" type="email" autoComplete="email" required maxLength={254} disabled={busy||!hydrated} /></label><button className={`${buttonClass} w-full`} disabled={busy || !ready||!hydrated}>{busy ? 'Preparing link…' : ready ? 'Send sign-in link' : 'Sign-in unavailable'}</button></form>
      {message ? <p role="alert" className="mt-4 text-base leading-normal">{message}</p> : null}
    </>}
    <p className="mt-5 text-base"><Link to="/" className={`inline-flex min-h-11 items-center font-normal ${textLinkClass}`}>Back to feedback</Link></p>
  </section></HydrationUnit><HydrationUnit><SignInArtBottom /></HydrationUnit></div></main></BrandRoot>
}
