import { useState, type FormEvent } from 'react'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import { operatorMutation } from '@/core/features/requests/ui/operator-client'
import { SectionCard } from '@/core/ui/app/SectionCard'
import { fieldLabelClass } from '@/core/ui/app/classes'
import { buttonClass, fieldClass, requesterStorageKey } from '../client-mutations'

/** Penny Dev only: mail is suppressed locally, so the operator verifies a test customer here. */
export function TestCustomers() {
  const [capabilities] = usePublicResource<{ testCustomers?: boolean }>('/api/auth/capabilities')
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  if (capabilities.kind !== 'ready' || !capabilities.data.testCustomers) return null
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    setBusy(true); setMessage('')
    try {
      const customer = await operatorMutation('/api/operator/dev/test-customer', { email: data.get('email'), displayName: data.get('displayName') }) as { token: string }
      localStorage.setItem(requesterStorageKey, customer.token)
      window.location.assign('/portal/feedback/new')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not add the test customer.'); setBusy(false) }
  }
  return <SectionCard id="settings-test-customers" icon="mail" title="Test customers (Penny Dev)" description="Penny Dev sends no email, so customers cannot verify an address here. Add a test customer instead: Penny marks the address verified and this browser opens the public board signed in as them, to submit, vote, follow and comment. Your operator session stays signed in. Deployed copies verify customers by email and do not show this.">
    <form onSubmit={add} className="grid min-w-0 grid-cols-1 items-end gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <label className={fieldLabelClass}>Display name<input name="displayName" required maxLength={160} defaultValue="Test customer" className={fieldClass} /></label>
      <label className={fieldLabelClass}>Email<input name="email" type="email" required maxLength={254} defaultValue="customer@example.com" className={fieldClass} /></label>
      <button className={buttonClass} disabled={busy}>{busy ? 'Opening…' : 'Add and open the board as them'}</button>
    </form>
    <p role="alert" className="mt-3 text-sm text-penny-danger empty:hidden">{message}</p>
  </SectionCard>
}
