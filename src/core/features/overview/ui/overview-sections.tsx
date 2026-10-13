import { Link } from '@tanstack/react-router'
import type { WorkspaceOverviewDto } from '@/core/features/workspace/overview-dto'
import { OperatorEmpty } from '@/core/app/ui/operator-resource-state'
import { formatOperatorDate, sourceLabel } from '@/core/app/ui/operator-format'
import { OperatorCard, OperatorDecisionState, OperatorRoadmapStatus } from '@/core/app/ui/operator-primitives'
import { textLinkClass } from '@/core/ui/app/classes'
import { DataField, dataRowClass } from '@/core/ui/app/DataField'
import { IconDisc } from '@/core/ui/app/Icon'
import { SectionHeading } from '@/core/ui/app/SectionHeading'
import { cardHoverClass, cardLinkClass } from './overview-parts'

type Overview = WorkspaceOverviewDto

const cardTitleClass = 'text-xl leading-[1.15] font-extrabold tracking-[-0.01em] text-penny-ink sm:text-[22px]'

export function DecisionsSection({ decisions }: { readonly decisions: Overview['decisions'] }) {
  return (
    <section aria-labelledby="overview-decisions" className="min-w-0">
      <SectionHeading id="overview-decisions" title="Needs a decision">Keep ready and review-due decisions visible until their next action is recorded.</SectionHeading>
      <div className="mt-4 space-y-4">
        {decisions.length === 0 ? <OperatorEmpty small title="No decisions need attention."><Link to="/app/decisions" className={textLinkClass}>Create a decision</Link> to compare your options.</OperatorEmpty> : decisions.map((decision) => (
          <Link key={decision.slug} to="/app/decisions/$decisionSlug" params={{ decisionSlug: decision.slug }} className={cardLinkClass}>
            <OperatorCard className={`p-5 sm:p-6 ${cardHoverClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-3"><OperatorDecisionState state={decision.state} /><span className="text-base text-penny-muted">{decision.owner?.displayName ?? 'No owner'}</span></div>
              <h3 className={`mt-3 ${cardTitleClass}`}>{decision.title}</h3>
              <dl className={`mt-4 border-t border-penny-line pt-4 ${dataRowClass}`}>
                <DataField label="Evidence" valueClassName="tabular-nums">{decision.evidenceCount}</DataField>
                <DataField label="Accounts" valueClassName="tabular-nums">{decision.accountCount}</DataField>
              </dl>
              <dl className="mt-4"><div className="flex items-center gap-3 text-base text-penny-ink"><dt className="flex items-center gap-3"><IconDisc name="calendar" />Review</dt><dd>{formatOperatorDate(decision.reviewAt)}</dd></div></dl>
            </OperatorCard>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function EvidenceSection({ evidence }: { readonly evidence: Overview['unreviewedEvidence'] }) {
  return (
    <section aria-labelledby="overview-evidence" className="min-w-0">
      <SectionHeading id="overview-evidence" title="Signal movement">Unreviewed evidence stays attributed before it is linked to a decision.</SectionHeading>
      <div className="mt-4 space-y-4">
        {evidence.length === 0 ? <OperatorEmpty small title="No evidence is awaiting review."><Link to="/app/feedback" className={textLinkClass}>Record evidence</Link> to capture the next customer signal.</OperatorEmpty> : evidence.map((item) => (
          <OperatorCard key={item.id} className="p-5 sm:p-6">
            <p className="text-lg leading-normal text-penny-ink">“{item.wording}”</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-penny-line pt-4 text-base text-penny-ink"><span className="flex items-center gap-3"><IconDisc name="evidence" size="small" />{sourceLabel(item.sourceType, item.sourceLabel)}</span><span>{item.account?.name ?? 'No account recorded'}</span></div>
          </OperatorCard>
        ))}
      </div>
    </section>
  )
}

export function RoadmapSection({ items }: { readonly items: Overview['roadmap'] }) {
  return (
    <section aria-labelledby="overview-roadmap" className="min-w-0">
      <SectionHeading id="overview-roadmap" title="Delivery promises">Internal delivery is distinct from the customer-safe public projection.</SectionHeading>
      <div className="mt-4 space-y-4">
        {items.length === 0 ? <OperatorEmpty small title="No active delivery items."><Link to="/app/decisions" className={textLinkClass}>Commit a decision</Link> to create an internal Planned item.</OperatorEmpty> : items.map((item) => (
          <Link key={item.slug} to="/app/roadmap" className={cardLinkClass}>
            <OperatorCard className={`p-5 sm:p-6 ${cardHoverClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-3"><OperatorRoadmapStatus status={item.status} /><span className="text-base text-penny-muted">{item.owner?.displayName ?? 'No owner'}</span></div>
              <h3 className={`mt-3 ${cardTitleClass}`}>{item.title}</h3>
              <p className="mt-2 text-base text-penny-muted">{item.targetWindow ?? 'No target window'}</p>
            </OperatorCard>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function ReleasesSection({ releases }: { readonly releases: Overview['recentReleases'] }) {
  return (
    <section aria-labelledby="overview-releases" className="min-w-0">
      <SectionHeading id="overview-releases" title="Recent published releases">Published updates from the last 30 days are customer-safe and versioned.</SectionHeading>
      <div className="mt-4 space-y-4">
        {releases.length === 0 ? <OperatorEmpty small title="No releases have been published recently."><Link to="/app/releases" className={textLinkClass}>Create a release</Link> when a delivery is ready to share.</OperatorEmpty> : releases.map((release) => (
          <Link key={release.slug} to="/app/releases/$releaseSlug" params={{ releaseSlug: release.slug }} className={cardLinkClass}>
            <OperatorCard className={`p-5 sm:p-6 ${cardHoverClass}`}>
              <h3 className={cardTitleClass}>{release.title}</h3>
              <p className="mt-2 text-base text-penny-muted">{release.outcomeTotal === 0 ? 'No recorded outcomes' : `${release.outcomeTotal ?? 0} recorded ${release.outcomeTotal === 1 ? 'outcome' : 'outcomes'}`}</p>
            </OperatorCard>
          </Link>
        ))}
      </div>
    </section>
  )
}
