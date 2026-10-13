import { Link } from '@tanstack/react-router'
import type { OperatorAccountDetail } from '@/core/shared/api/operator'
import { OperatorCard, OperatorDecisionState } from '@/core/app/ui/operator-primitives'
import { WorkspaceLink } from '@/core/features/workspace/ui/workspace-link'
import { CustomFieldsEditor } from '@/core/features/settings/ui/custom-fields-editor'
import { textLinkClass } from '@/core/ui/app/classes'
import { EmptyNote } from '@/core/ui/app/EmptyState'
import { Icon } from '@/core/ui/app/Icon'
import { AccountEvidenceTimeline } from './account-evidence-timeline'

type AccountProps = { readonly account: OperatorAccountDetail }

function CollectionSummary({ shown, total, label, href }: { shown: number; total: number; label: string; href: string }) {
  if (total === 0) return null
  return <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
    <p className="text-penny-muted">Showing {shown} of {total} {label}</p>
    <WorkspaceLink href={href} className={`${textLinkClass} inline-flex min-h-11 items-center`}>View all {label}</WorkspaceLink>
  </div>
}

export function AccountLinkedDecisions({ account }: AccountProps) {
  return <section aria-labelledby="account-decisions">
    <h2 id="account-decisions" className="text-xl font-bold tracking-[-0.02em] text-penny-ink">Linked decisions</h2>
    <CollectionSummary shown={account.decisions.length} total={account.linkedDecisionCount} label="linked decisions" href={`/app/decisions?account=${encodeURIComponent(account.slug)}&sort=name`} />
    <div className="mt-3 space-y-3">{account.decisions.length === 0 ? <EmptyNote>No decision is linked to this account yet.</EmptyNote> : account.decisions.map(decision =>
      <Link key={decision.slug} to="/app/decisions/$decisionSlug" params={{ decisionSlug: decision.slug }} className="block min-w-0 rounded-xl">
        <OperatorCard className="flex min-h-16 flex-wrap items-center justify-between gap-4 p-5 transition-colors hover:border-penny-line-strong">
          <span className="min-w-0 break-words font-bold text-penny-ink">{decision.title}</span>
          <span className="flex shrink-0 items-center gap-3"><OperatorDecisionState state={decision.state} /><Icon name="arrow" className="text-penny-ink" /></span>
        </OperatorCard>
      </Link>)}</div>
  </section>
}

export function AccountLinkedRequests({ account }: AccountProps) {
  return <section aria-labelledby="account-requests">
    <h2 id="account-requests" className="text-xl font-bold tracking-[-0.02em] text-penny-ink">Linked requests</h2>
    <CollectionSummary shown={account.requests.length} total={account.linkedRequestCount} label="linked requests" href={`/app/moderation?account=${encodeURIComponent(account.slug)}&sort=name`} />
    <div className="mt-3 space-y-3">{account.requests.length === 0 ? <EmptyNote>No request is linked to this account yet.</EmptyNote> : account.requests.map(request =>
      <WorkspaceLink key={request.id} href={`/app/moderation?item=${encodeURIComponent(request.id)}#request-${encodeURIComponent(request.slug)}`} className="block min-w-0 rounded-xl">
        <OperatorCard className="flex min-h-16 items-center justify-between gap-4 p-5 transition-colors hover:border-penny-line-strong">
          <span className="min-w-0 break-words font-bold text-penny-ink">{request.title}</span><Icon name="arrow" className="shrink-0 text-penny-ink" />
        </OperatorCard>
      </WorkspaceLink>)}</div>
  </section>
}

export function AccountEvidence({ account }: AccountProps) {
  return <section aria-labelledby="account-evidence">
    <h2 id="account-evidence" className="text-xl font-bold tracking-[-0.02em] text-penny-ink">Evidence chronology</h2>
    <CollectionSummary shown={account.evidence.length} total={account.evidenceCount} label="evidence items" href={`/app/feedback?account=${encodeURIComponent(account.slug)}&sort=observed`} />
    <div className="mt-3"><AccountEvidenceTimeline evidence={account.evidence} /></div>
  </section>
}

export function AccountLinkedRequesters({ account }: AccountProps) {
  return <OperatorCard className="p-5">
    <h2 className="text-base font-bold text-penny-ink">Linked requesters</h2>
    <CollectionSummary shown={account.requesters.length} total={account.requesterCount} label="linked requesters" href={`/app/customers?directory=requesters&account=${encodeURIComponent(account.slug)}&sort=name`} />
    {account.requesters.length === 0 ? <p className="mt-3 text-sm leading-6 text-penny-muted">No requester identity is linked to this account.</p> :
      <ul className="mt-3 divide-y divide-penny-line">{account.requesters.map(requester => <li key={requester.id} className="py-3 first:pt-0 last:pb-0">
        <p className="break-words font-semibold text-penny-ink">{requester.displayName}</p>
        {requester.email ? <p className="mt-1 break-all text-sm text-penny-muted">{requester.email}</p> : null}
        <CustomFieldsEditor entityType="requester" entityId={requester.id} />
      </li>)}</ul>}
    <p className="mt-5 border-t border-penny-line pt-4 text-xs leading-5 text-penny-muted">Requester addresses are visible only in this authenticated operator workspace.</p>
  </OperatorCard>
}
