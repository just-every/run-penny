import {DraftPanel} from '../../ai/ui/draft-panel'
import { CustomFieldsEditor } from '@/core/features/settings/ui/custom-fields-editor'
import { DecisionReview } from './decision-review'
import { DecisionPostRelease } from './decision-post-release'
import { DecisionActions } from './decision-actions'
import {TrackerActions} from '../../integrations/ui/tracker-actions'
import { Link } from '@tanstack/react-router'
import type { OperatorDecisionBrief } from '@/core/shared/api/operator'
import { OperatorDetailBack, OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { formatOperatorDate } from '@/core/app/ui/operator-format'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorResourceFailure, OperatorResourceLoading, OperatorResourceNotFound, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { OperatorCard, OperatorDecisionState } from '@/core/app/ui/operator-primitives'
import { Icon } from '@/core/ui/app/Icon'
import { textLinkClass } from '@/core/ui/app/classes'
import { CandidateBetCard } from './candidate-bet-card'
import { DataField, dataRowClass } from '@/core/ui/app/DataField'
import { SectionHeading } from '@/core/ui/app/SectionHeading'

const nextStepClass = 'rounded-lg border border-penny-line bg-penny-paper px-4 py-3 text-base text-penny-ink'

export function DecisionBriefPage({ decisionSlug }: { readonly decisionSlug: string }) {
  const [decision, retry] = useOperatorResource<OperatorDecisionBrief>(`/api/operator/decisions/${encodeURIComponent(decisionSlug)}`)
  return <>{decision.kind === 'loading' ? <OperatorResourceLoading label="Loading decision brief…" /> : null}{decision.kind === 'session_expired' ? <OperatorSessionExpired /> : null}{decision.kind === 'not_found' ? <DecisionNotFound /> : null}{decision.kind === 'error' ? <OperatorResourceFailure title="We could not load this decision brief." status={decision.status} message={decision.message} onRetry={retry} /> : null}{decision.kind === 'ready' ? <DecisionContent decision={decision.data} onSaved={retry} /> : null}</>
}

function DecisionNotFound() {
  return <><OperatorDetailBack to="/app/decisions">All decisions</OperatorDetailBack><OperatorResourceNotFound title="Decision not found">This decision may have been removed or its URL is no longer valid.</OperatorResourceNotFound></>
}

function DecisionContent({ decision, onSaved }: { readonly decision: OperatorDecisionBrief; onSaved: () => void }) {
  const selected = decision.bets.find((bet) => bet.id === decision.selectedCandidateBetId)
  const editable = ['draft', 'ready'].includes(decision.state)
  return (
    <>
      <OperatorDetailBack to="/app/decisions">All decisions</OperatorDetailBack>
      <OperatorPageHeader eyebrow="Decision brief" title={decision.title} art={{ note: 'Good decisions compound.' }}>{decision.question.trim() !== decision.title.trim() ? <span>{decision.question}</span> : null}</OperatorPageHeader>
      <DraftPanel kind="decision" id={decision.id} />
      <div className="mt-6 space-y-10 sm:mt-8">
        <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)]">
          <OperatorCard className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <OperatorDecisionState state={decision.state} />
              <span className="text-base text-penny-ink sm:text-[17px]">{decision.owner?.displayName ?? 'No owner'}</span>
            </div>
            <dl className={`mt-4 border-t border-penny-line pt-4 ${dataRowClass}`}>
              <DataField label="Confidence">{decision.confidence ?? 'Not recorded'}</DataField>
              <DataField label="Review date">{formatOperatorDate(decision.reviewAt)}</DataField>
              <DataField label="Linked evidence" valueClassName="tabular-nums">{decision.evidenceCount}</DataField>
            </dl>
          </OperatorCard>
          <OperatorCard className="p-5 sm:p-6">
            <h2 className="text-xl leading-[1.15] font-extrabold tracking-[-0.01em] text-penny-ink sm:text-[22px]">Commitment record</h2>
            {decision.rationale ? <blockquote className="mt-3 border-l-3 border-penny-copper pl-4 text-lg leading-normal break-words text-penny-ink">{decision.rationale}</blockquote> : <p className="mt-3 text-base leading-normal text-penny-muted">No commitment rationale has been recorded.</p>}
            <p className="mt-3 text-base leading-normal text-penny-muted">{selected ? `Selected option: ${selected.title}.` : 'No option has been selected.'}</p>
            {decision.roadmapItem ? <Link to="/app/roadmap" className="mt-1 inline-flex min-h-11 items-center gap-2 text-base text-penny-ink underline decoration-penny-ink/40 underline-offset-4 hover:decoration-penny-copper">View {decision.roadmapItem.title} on roadmap <Icon name="arrow" /></Link> : null}
          </OperatorCard>
        </section>
        <section aria-labelledby="candidate-bets">
          <SectionHeading id="candidate-bets" title="Evidence and alternatives">Every option keeps assumptions, counter-evidence, and attributable source material visible. Penny does not calculate a combined score. Shared evidence and accounts count once in brief totals, even when linked to several bets.</SectionHeading>
          <div className="mt-4 grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
            {decision.bets.map((bet) => <CandidateBetCard key={bet.id} bet={bet} selected={bet.id === decision.selectedCandidateBetId} decisionId={decision.id} onSaved={onSaved} editable={editable} declined={['committed', 'review_due'].includes(decision.state) && bet.id !== decision.selectedCandidateBetId} />)}
          </div>
        </section>
        {decision.bets.length === 0 && editable ? <p className={nextStepClass}>Next: add a candidate bet using Add candidate bet below.</p> : null}
        {decision.evidenceCount === 0 ? <p className={nextStepClass}>{decision.bets.length > 0 ? <>Next: link evidence to each bet using Manage this bet. To capture more, <Link to="/app/feedback" className={textLinkClass}>record it in the Evidence inbox</Link>.</> : <>Next: <Link to="/app/feedback" className={textLinkClass}>record evidence in the Evidence inbox</Link>. Add a candidate bet in a draft brief to compare it.</>}</p> : null}
        <DecisionActions decision={decision} onSaved={onSaved} /><DecisionReview decision={decision} onSaved={onSaved}/>{!editable?<DecisionPostRelease id={decision.id}/>:null}
        <CustomFieldsEditor entityType="decision" entityId={decision.id} />
        <TrackerActions card decisionId={decision.id} reload={onSaved} />
      </div>
    </>
  )
}
