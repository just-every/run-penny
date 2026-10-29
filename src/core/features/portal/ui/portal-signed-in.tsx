import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { hostRequesterName } from '@/core/features/auth/host-client'
import { requesterStorageKey } from '@/core/features/auth/client-mutations'

/** The verified customer's name for the portal header: a host sign-in, else the saved email-verified session. */
function useVerifiedCustomer(): string | null {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    const read = () => {
      const host = hostRequesterName()
      if (host) { setName(host); return }
      const token = localStorage.getItem(requesterStorageKey)
      if (!token) { setName(null); return }
      void fetch('/api/public/identity/session', { headers: { Authorization: `Bearer ${token}` } })
        .then(async response => { if (current) setName(response.ok ? (await response.json() as { displayName: string }).displayName : null) })
        .catch(() => { if (current) setName(null) })
    }
    read()
    window.addEventListener('penny-requester-changed', read)
    return () => { current = false; window.removeEventListener('penny-requester-changed', read) }
  }, [])
  return name
}

/** A verified customer's name in the header. A customer who is not verified sees nothing: customers verify by email when they vote or submit, and operators sign in from the footer. */
export function PortalSignedIn({ className }: { readonly className: string }) {
  const name = useVerifiedCustomer()
  if (!name) return null
  return <Link to="/portal/feedback/activity" className={`${className} max-w-full gap-1 break-words`}><span className="text-penny-muted">Signed in as</span> <span className="font-semibold text-penny-ink">{name}</span></Link>
}
