import { ReleaseEditor } from './release-editor'
import { StatusDrafts } from './status-drafts'
import type { OperatorReleaseCard } from '@/core/shared/api/operator'
import { OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { useOperatorList, ListControls } from '@/core/features/workspace/ui/list-controls'
import { OperatorEmpty, OperatorResourceFailure, OperatorResourceLoading, OperatorResourceNotFound, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { ReleaseCard } from './release-card'
import { SectionHeading } from '@/core/ui/app/SectionHeading'

export function ReleasesPage() {
  const [releases, retry, page] = useOperatorList<OperatorReleaseCard>('/api/operator/releases')
  const empty = releases.kind === 'ready' && releases.data.length === 0
  return <><OperatorPageHeader eyebrow="Releases queue" title="Close the loop with the customers who made the decision possible." art={empty || releases.kind === 'error' ? null : { note: "It's live — thanks for asking." }}>Publish customer-safe status updates and releases to close the loop with followers.</OperatorPageHeader><ListControls page={page} entity="releases"/><StatusDrafts/><div className="mt-8"><ReleaseEditor onSaved={retry}/></div><section className="mt-10" aria-labelledby="release-list-heading"><SectionHeading id="release-list-heading" title="Releases" /><div className="mt-4">{releases.kind === 'loading' ? <OperatorResourceLoading label="Loading releases…" /> : null}{releases.kind === 'session_expired' ? <OperatorSessionExpired /> : null}{releases.kind === 'not_found' ? <OperatorResourceNotFound title="Release queue unavailable">This workspace release route is not available.</OperatorResourceNotFound> : null}{releases.kind === 'error' ? <OperatorResourceFailure title="We could not load releases." status={releases.status} onRetry={retry} /> : null}{empty ? <OperatorEmpty title="No releases have been created.">A release draft appears after an operator prepares customer-safe wording for a roadmap target.</OperatorEmpty> : null}{releases.kind === 'ready' ? <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">{releases.data.map((release) => <ReleaseCard key={release.slug} release={release} />)}</div> : null}</div></section></>
}
