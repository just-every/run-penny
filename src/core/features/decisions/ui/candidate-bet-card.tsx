import { BetActions } from './decision-actions'
import type { OperatorDecisionBrief } from '@/core/shared/api/operator'
import { formatObservedAt, formatRevenue, sourceLabel } from '@/core/app/ui/operator-format'
import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { Chip } from '@/core/ui/app/Chip'
import { DataField, dataRowClass } from '@/core/ui/app/DataField'
import { IconDisc } from '@/core/ui/app/Icon'

type CandidateBet = OperatorDecisionBrief['bets'][number]

export function CandidateBetCard({ bet, selected, decisionId, onSaved, editable = false, declined = false }: { readonly bet: CandidateBet; readonly selected: boolean; decisionId?: string; onSaved?: () => void; editable?: boolean; declined?: boolean }) {
  const requesters = bet.metrics.affectedRequesterCount ?? 0
  return (
    <OperatorCard className={`p-5 sm:p-6 ${selected ? 'border-2 !border-penny-copper' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {selected ? <Chip tone="selected">Selected commitment</Chip> : <Chip tone={declined ? 'muted' : 'neutral'}>{declined ? 'Declined' : 'Alternative'}</Chip>}
        <span className="text-sm text-penny-muted sm:text-[15px]">{bet.metrics.affectedAccountCount} affected {bet.metrics.affectedAccountCount === 1 ? 'account' : 'accounts'} · {requesters} {requesters === 1 ? 'requester' : 'requesters'}</span>
      </div>
      <h2 className="mt-3 text-[22px] leading-[1.15] font-extrabold tracking-[-0.01em] text-penny-ink sm:text-2xl">{bet.title}</h2>
      <p className="mt-2 text-base leading-normal text-penny-muted">{bet.summary}</p>
      <dl className={`mt-4 border-t border-penny-line pt-4 ${dataRowClass}`}>
        <DataField label="Urgency" valueClassName="leading-normal">{bet.urgency}</DataField>
        <DataField label="Delivery shape" valueClassName="leading-normal">{bet.deliveryShape}</DataField>
      </dl>
      <dl className="mt-4 divide-y divide-penny-line border-t border-penny-line [&>*]:py-3">
        <DataField label="Success measure" valueClassName="leading-normal">{bet.successMeasure}</DataField>
        <DataField label="Assumptions" valueClassName="leading-normal">{bet.assumptions}</DataField>
        <DataField label="Counter-evidence" valueClassName="leading-normal">{bet.counterEvidence}</DataField>
      </dl>
      <section className="mt-2 border-t border-penny-line pt-4" aria-label={`${bet.title} evidence`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-penny-ink">Evidence</h3>
          <p className="text-sm text-penny-muted">{bet.metrics.supportingCount} supporting · {bet.metrics.contradictingCount} contradicting</p>
        </div>
        <p className="mt-1 text-sm text-penny-muted">Latest support: {bet.metrics.latestSupportAt ? <time dateTime={bet.metrics.latestSupportAt}>{formatObservedAt(bet.metrics.latestSupportAt)}</time> : 'Not recorded'}</p>
        {(['supporting', 'contradicting'] as const).map((stance) => {
          const items = bet.evidence.filter((e) => e.stance === stance)
          return (
            <div key={stance} className="mt-4">
              <h4 className="text-base font-semibold text-penny-ink">{stance === 'supporting' ? 'Supports' : 'Contradicts'} ({items.length})</h4>
              {items.map((evidence) => (
                <article key={evidence.id} className="mt-2 flex min-w-0 flex-wrap items-start gap-x-3 gap-y-2 rounded-lg bg-penny-sand/25 p-3">
                  <span className="flex items-center gap-2"><IconDisc name="evidence" size="small" /><Chip tone={stance === 'supporting' ? 'sand' : 'copper-outline'}>{stance === 'supporting' ? 'Supporting' : 'Contradicting'}</Chip></span>
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="text-base leading-normal break-words whitespace-pre-wrap text-penny-ink">“{evidence.wording}”</p>
                    <p className="mt-1 text-sm text-penny-muted">{sourceLabel(evidence.sourceType, evidence.sourceLabel)} · {evidence.account?.name ?? 'No account recorded'}{evidence.requester ? ` · ${evidence.requester.displayName}` : ''}</p>
                  </div>
                </article>
              ))}
            </div>
          )
        })}
        {bet.evidence.length === 0 ? <p className="mt-3 text-base text-penny-ink">Next: link recorded evidence using Manage this bet.</p> : null}
      </section>
      <section className="mt-5 border-t border-penny-line pt-4" aria-label={`${bet.title} affected accounts`}>
        <h3 className="text-lg font-bold text-penny-ink">Affected accounts</h3>
        <ul className="mt-2 divide-y divide-penny-line">
          {bet.accounts.map((account) => (
            <li key={account.slug} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-base">
              <span className="font-semibold text-penny-ink">{account.name}</span>
              <span className="text-penny-muted tabular-nums">{formatRevenue(account.revenueCents)} · {account.health ?? 'No health context'}</span>
            </li>
          ))}
        </ul>
      </section>
      {decisionId && onSaved ? <BetActions decisionId={decisionId} bet={bet} onSaved={onSaved} editable={editable} /> : null}
    </OperatorCard>
  )
}
