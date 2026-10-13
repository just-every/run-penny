import { CustomFieldsEditor } from '@/core/features/settings/ui/custom-fields-editor'
import { AccountEditor } from './account-editor'
import type { OperatorAccountDetail } from '@/core/shared/api/operator'
import { OperatorDetailBack, OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { formatOperatorDate, formatRevenue } from '@/core/app/ui/operator-format'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorResourceFailure, OperatorResourceLoading, OperatorResourceNotFound, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { AccountEvidence, AccountLinkedDecisions, AccountLinkedRequests, AccountLinkedRequesters } from './account-linked-collections'
import { DataField } from '@/core/ui/app/DataField'

export function AccountDetailPage({ accountSlug }: { readonly accountSlug: string }) {
  const [account, retry] = useOperatorResource<OperatorAccountDetail>(`/api/operator/accounts/${encodeURIComponent(accountSlug)}`)
  return <>{account.kind === 'loading' ? <OperatorResourceLoading label="Loading account context…" /> : null}{account.kind === 'session_expired' ? <OperatorSessionExpired /> : null}{account.kind === 'not_found' ? <AccountNotFound /> : null}{account.kind === 'error' ? <OperatorResourceFailure title="We could not load this account." status={account.status} onRetry={retry} /> : null}{account.kind === 'ready' ? <AccountContent account={account.data} onSaved={retry} /> : null}</>
}

function AccountNotFound() {
  return <><OperatorDetailBack to="/app/customers">All accounts</OperatorDetailBack><OperatorResourceNotFound title="Account not found">This account may have been removed or its URL is no longer valid.</OperatorResourceNotFound></>
}

function AccountContent({ account, onSaved }: { readonly account: OperatorAccountDetail; onSaved: () => void }) {
  return <>
    <OperatorDetailBack to="/app/customers">All accounts</OperatorDetailBack>
    <OperatorPageHeader eyebrow="Account detail" title={account.name} art={{ note: 'Every customer, heard.' }}><span>Customer context is operator-only and stays linked to the decisions and evidence it informs.</span></OperatorPageHeader>
    <AccountEditor account={account} onSaved={onSaved} />
    <div className="mt-7 grid min-w-0 grid-cols-1 gap-7 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-8">
        <OperatorCard className="p-5 sm:p-6">
          <h2 className="text-base font-bold text-penny-ink">Account snapshot</h2>
          <CustomFieldsEditor entityType="account" entityId={account.id} />
          <dl className="mt-4 grid grid-cols-2 gap-5 lg:grid-cols-4">
            <DataField label="Commercial context" valueClassName="font-semibold tabular-nums">{formatRevenue(account.revenueCents)}</DataField>
            <DataField label="Renewal" valueClassName="font-semibold tabular-nums">{formatOperatorDate(account.renewalDate)}</DataField>
            <DataField label="Requesters" valueClassName="font-semibold tabular-nums">{String(account.requesterCount)}</DataField>
            <DataField label="Evidence" valueClassName="font-semibold tabular-nums">{String(account.evidenceCount)}</DataField>
          </dl>
          <p className="mt-5 border-t border-penny-line pt-4 text-sm leading-6 text-penny-muted">Health: {account.health ?? 'Not recorded'} · Owner: {account.owner?.displayName ?? 'Not assigned'}</p>
        </OperatorCard>
        <AccountLinkedDecisions account={account} />
        <AccountLinkedRequests account={account} />
        <AccountEvidence account={account} />
      </div>
      <aside className="min-w-0"><AccountLinkedRequesters account={account} /></aside>
    </div>
  </>
}
