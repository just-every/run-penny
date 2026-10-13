import { Link } from '@tanstack/react-router'
import type { OperatorDecisionListItem } from '@/core/shared/api/operator'
import { formatOperatorDate } from '@/core/app/ui/operator-format'
import { OperatorCard, OperatorDecisionState } from '@/core/app/ui/operator-primitives'
import { Icon } from '@/core/ui/app/Icon'
import { DataField, dataRowClass } from '@/core/ui/app/DataField'

export function DecisionRow({ decision }: { readonly decision: OperatorDecisionListItem }) {
  return (
    <Link to="/app/decisions/$decisionSlug" params={{ decisionSlug: decision.slug }} className="group block rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-penny-accent">
      <OperatorCard className="p-5 transition-colors group-hover:border-penny-line-strong group-hover:bg-penny-paper sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <OperatorDecisionState state={decision.state} />
          <span className="inline-flex items-center gap-1.5 text-base text-penny-ink underline decoration-penny-ink/40 underline-offset-4 group-hover:decoration-penny-copper">Open brief <Icon name="arrow" /></span>
        </div>
        <h2 className="mt-3 text-[22px] leading-[1.15] font-extrabold tracking-[-0.01em] text-penny-ink sm:text-[28px]">{decision.title}</h2>
        <dl className={`mt-4 border-t border-penny-line pt-4 ${dataRowClass}`}>
          <DataField label="Owner">{decision.owner?.displayName ?? 'No owner'}</DataField>
          <DataField label="Evidence" valueClassName="tabular-nums">{decision.evidenceCount}</DataField>
          <DataField label="Accounts" valueClassName="tabular-nums">{decision.accountCount}</DataField>
          <DataField label="Review date">{formatOperatorDate(decision.reviewAt)}</DataField>
        </dl>
        <div className="mt-4 flex flex-col gap-1 border-t border-penny-line pt-4 text-base text-penny-muted sm:flex-row sm:items-center sm:gap-4 sm:border-t-0 sm:pt-0">
          <p>Last action: {lastActionLabel(decision.lastAction)}{decision.lastActionAt ? ` · ${formatOperatorDate(decision.lastActionAt)}` : ''}</p>
          {decision.evidenceCount === 0 ? <p className="sm:border-l sm:border-penny-line sm:pl-4">Next: link evidence to a candidate bet.</p> : null}
        </div>
      </OperatorCard>
    </Link>
  )
}

function lastActionLabel(action: string | null | undefined) {
  const labels: Record<string, string> = { 'decision.created': 'Decision created', 'decision.edited': 'Brief edited', 'decision.evidence_changed': 'Evidence links changed', 'decision.committed': 'Decision committed', 'bet.added': 'Candidate bet added', 'bet.edited': 'Comparison edited', 'roadmap.moved': 'Roadmap moved' }
  return action ? labels[action] ?? action.replaceAll('.', ' ').replaceAll('_', ' ') : 'Created'
}
