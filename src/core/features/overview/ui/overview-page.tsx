import { Link } from '@tanstack/react-router'
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
  const [overview, retry] = useOperatorResource<WorkspaceOverviewDto>('/api/operator/overview')

  return (
    <>
      <OperatorPageHeader eyebrow="Planning workspace" title="Make the next roadmap call defensible." art={overview.kind === 'error' ? null : { note: 'From feedback to progress.' }}>Bring customer evidence, accountable decisions, delivery promises, and release outcomes into one operating view.</OperatorPageHeader>
      <div className="mt-6 sm:mt-8">
        {overview.kind === 'loading' ? <OperatorResourceLoading label="Loading your operator overview…" /> : null}
        {overview.kind === 'session_expired' ? <OperatorSessionExpired /> : null}
        {overview.kind === 'not_found' ? <OperatorResourceNotFound title="Operator overview unavailable">The workspace overview could not be found.</OperatorResourceNotFound> : null}
        {overview.kind === 'error' ? <OperatorResourceFailure title="We could not load the operator overview." status={overview.status} onRetry={retry} /> : null}
        {overview.kind === 'ready' ? <OverviewContent overview={overview.data} /> : null}
      </div>
    </>
  )
}

function OverviewContent({ overview }: { readonly overview: WorkspaceOverviewDto }) {
  return (
    <div className="space-y-10">
      <AttentionSection overview={overview} />
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
  const ready = overview.decisions.filter((row) => row.state === 'ready').length
  const total = overview.awaitingModeration.length + overview.unreviewedEvidence.length + ready + overview.unpublishedStatusUpdates.length + overview.shippedWithoutRelease.length

  return (
    <section aria-labelledby="overview-attention">
      <SectionHeading id="overview-attention" title="Needs you">Take the next action on feedback, decisions and delivery.</SectionHeading>
      <ul className="mt-4 grid min-w-0 list-none gap-4 p-0">
        {overview.awaitingModeration.length > 0 ? <AttentionLink to="/app/moderation" icon="moderation" count={overview.awaitingModeration.length} singular="request awaiting moderation" plural="requests awaiting moderation" /> : null}
        {overview.unreviewedEvidence.length > 0 ? <AttentionLink to="/app/feedback" icon="evidence" count={overview.unreviewedEvidence.length} singular="unreviewed evidence item" plural="unreviewed evidence items" /> : null}
        {ready > 0 ? <AttentionLink to="/app/decisions" icon="decisions" count={ready} singular="ready decision" plural="ready decisions" /> : null}
        {overview.unpublishedStatusUpdates.length > 0 ? <AttentionLink to="/app/roadmap" icon="roadmap" count={overview.unpublishedStatusUpdates.length} singular="unpublished status update" plural="unpublished status updates" /> : null}
        {overview.shippedWithoutRelease.length > 0 ? <AttentionLink to="/app/releases" icon="releases" count={overview.shippedWithoutRelease.length} singular="Shipped item without a published release" plural="Shipped items without a published release" /> : null}
      </ul>
      {total === 0 ? (
        <OperatorCard className="mt-4 p-5 sm:p-6">
          <h3 className="text-lg font-bold text-penny-ink">{overview.decisions.some((row) => row.state === 'review_due') ? 'Review your due decisions below.' : 'Nothing needs your attention.'}</h3>
          <p className="mt-2 text-base">{overview.boardCount === 0 ? <Link to="/app/settings" className={accentLinkClass}>Create a board to collect feedback.</Link> : <Link to="/app/feedback" className={accentLinkClass}>Record evidence to inform your next decision.</Link>}</p>
        </OperatorCard>
      ) : null}
    </section>
  )
}
