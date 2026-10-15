import { WorkspaceLink } from '@/core/features/workspace/ui/workspace-link'
import { useLocation } from '@tanstack/react-router'
import { RequesterDirectory } from '@/core/features/workspace/ui/requester-directory'
import { secondaryButtonClass } from '@/core/ui/app/classes'
import { AccountEditor } from './account-editor'
import type { OperatorAccountCard } from '@/core/shared/api/operator'
import { OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { useOperatorList, ListControls } from '@/core/features/workspace/ui/list-controls'
import { OperatorEmpty, OperatorResourceFailure, OperatorResourceLoading, OperatorResourceNotFound, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { AccountCard } from './account-card'
import { SectionHeading } from '@/core/ui/app/SectionHeading'

export function AccountsPage() {
  const directory = new URLSearchParams(useLocation().searchStr).get('directory') === 'requesters'
  return <><nav aria-label="Customer context" className="mb-6 flex gap-3"><WorkspaceLink href="/app/customers" className={secondaryButtonClass}>Accounts</WorkspaceLink><WorkspaceLink href="/app/customers?directory=requesters" className={secondaryButtonClass}>Requesters</WorkspaceLink></nav>{directory ? <RequesterDirectory/> : <AccountList/>}</>
}

function AccountList() {
  const [accounts, retry, page] = useOperatorList<OperatorAccountCard>('/api/operator/accounts')
  const empty = accounts.kind === 'ready' && accounts.data.length === 0
  return <><OperatorPageHeader eyebrow="Account context" title="See who is represented in a product decision." art={empty || accounts.kind === 'error' ? null : { note: 'Every customer, heard.' }}>Commercial timing and customer evidence stay attributable without turning this product into a CRM.</OperatorPageHeader><ListControls page={page} entity="accounts"/><AccountEditor onSaved={retry}/><section className="mt-8" aria-labelledby="account-list-heading"><SectionHeading id="account-list-heading" title="Accounts" /><div className="mt-4">{accounts.kind === 'loading' ? <OperatorResourceLoading label="Loading accounts…" /> : null}{accounts.kind === 'session_expired' ? <OperatorSessionExpired /> : null}{accounts.kind === 'not_found' ? <OperatorResourceNotFound title="Accounts unavailable">This workspace accounts route is not available.</OperatorResourceNotFound> : null}{accounts.kind === 'error' ? <OperatorResourceFailure title="We could not load accounts." status={accounts.status} message={accounts.message} onRetry={retry} /> : null}{empty ? <OperatorEmpty title="No account context has been recorded.">Accounts appear when evidence or a requester is explicitly linked to one.</OperatorEmpty> : null}{accounts.kind === 'ready' ? <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">{accounts.data.map((account) => <AccountCard key={account.slug} account={account} />)}</div> : null}</div></section></>
}
