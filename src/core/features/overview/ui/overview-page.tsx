import {AgingPanel} from '../../triage/aging-panel'
import { ListControls } from '@/core/features/workspace/ui/list-controls'
import { Link, useLocation } from '@tanstack/react-router'
import type { WorkspaceOverviewDto } from '@/core/features/workspace/overview-dto'
import { OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorResourceFailure, OperatorResourceLoading, OperatorResourceNotFound, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { accentLinkClass } from '@/core/ui/app/classes'
import { SectionHeading } from '@/core/ui/app/SectionHeading'
import { AttentionLink } from './overview-parts'
import { DecisionsSection, EvidenceSection, ReleasesSection, RoadmapSection } from './overview-sections'

export function OverviewPage() {
  const [overview, retry] = useOperatorResource<WorkspaceOverviewDto>(`/api/operator/overview${useLocation().searchStr}`)

  return (
    <>
      <OperatorPageHeader eyebrow="Planning workspace" title="Make the next roadmap call defensible." art={overview.kind === 'error' ? null : { note: 'From feedback to progress.' }}>Bring customer evidence, accountable decisions, delivery promises, and release outcomes into one operating view.</OperatorPageHeader><ListControls entity="overview" page={overview.kind==='ready'?overview.data.pagination:null}/>
      <div className="mt-6 sm:mt-8">
        {overview.kind === 'loading' ? <OperatorResourceLoading label="Loading your operator overview…" /> : null}
        {overview.kind === 'session_expired' ? <OperatorSessionExpired /> : null}
        {overview.kind === 'not_found' ? <OperatorResourceNotFound title="Operator overview unavailable">The workspace overview could not be found.</OperatorResourceNotFound> : null}
        {overview.kind === 'error' ? <OperatorResourceFailure title="We could not load the operator overview." status={overview.status} message={overview.message} onRetry={retry} /> : null}
        {overview.kind === 'ready' ? <OverviewContent overview={overview.data} /> : null}
      </div>
    </>
  )
}

function OverviewContent({ overview }: { readonly overview: WorkspaceOverviewDto }) {
  return (
    <div className="space-y-10">
      <AttentionSection overview={overview} />
      <AgingPanel/>
      <div className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-2">
        <DecisionsSection decisions={overview.decisions} />
        <EvidenceSection evidence={overview.unreviewedEvidence} />
        <RoadmapSection items={overview.roadmap} />
        <ReleasesSection releases={overview.recentReleases} />
      </div>
    </div>
  )
}

function AttentionSection({ overview }: { readonly overview: WorkspaceOverviewDto }) {
  const ready = overview.counts.readyDecisions
  const reviewDue = overview.counts.reviewDueDecisions
  const total = overview.counts.moderation + overview.counts.comments + overview.counts.evidence + ready + reviewDue + overview.counts.updates + overview.counts.shipped

  return (
    <section aria-labelledby="overview-attention">
      <SectionHeading id="overview-attention" title="Needs you">Take the next action on feedback, decisions and delivery.</SectionHeading>
      <ul className="mt-4 grid min-w-0 list-none gap-4 p-0">
        {overview.counts.moderation > 0 ? <AttentionLink to="/app/moderation" icon="moderation" count={overview.counts.moderation} singular="request awaiting moderation" plural="requests awaiting moderation" /> : null}
        {overview.counts.comments > 0 ? <AttentionLink to="/app/moderation" icon="moderation" count={overview.counts.comments} singular="comment awaiting review" plural="comments awaiting review" /> : null}
        {overview.counts.evidence > 0 ? <AttentionLink to="/app/feedback" icon="evidence" count={overview.counts.evidence} singular="unreviewed evidence item" plural="unreviewed evidence items" /> : null}
        {ready > 0 ? <AttentionLink to="/app/decisions" icon="decisions" count={ready} singular="ready decision" plural="ready decisions" /> : null}
        {reviewDue > 0 ? <AttentionLink to="/app/decisions" icon="decisions" count={reviewDue} singular="decision due for review" plural="decisions due for review" /> : null}
        {overview.counts.updates > 0 ? <AttentionLink to="/app/roadmap" icon="roadmap" count={overview.counts.updates} singular="unpublished status update" plural="unpublished status updates" /> : null}
        {overview.counts.shipped > 0 ? <AttentionLink to="/app/releases" icon="releases" count={overview.counts.shipped} singular="Shipped item without a published release" plural="Shipped items without a published release" /> : null}
      </ul>
      {total === 0 ? (
        <OperatorCard className="mt-4 p-5 sm:p-6">
          <h3 className="text-lg font-bold text-penny-ink">Nothing needs your attention.</h3>
          <p className="mt-2 text-base">{overview.boardCount === 0 ? <Link to="/app/settings" hash="create-board" className={accentLinkClass}>Create a board to collect feedback.</Link> : <Link to="/app/feedback" className={accentLinkClass}>Record evidence to inform your next decision.</Link>}</p>
        </OperatorCard>
      ) : null}
    </section>
  )
}
