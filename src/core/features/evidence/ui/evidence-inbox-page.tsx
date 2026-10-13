import { EvidenceRecorder } from './evidence-actions'
import { useSearch } from '@tanstack/react-router'
import type { OperatorEvidenceCard } from '@/core/shared/api/operator'
import { OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorEmpty, OperatorResourceFailure, OperatorResourceLoading, OperatorResourceNotFound, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { EvidenceCard } from './evidence-card'

export function EvidenceInboxPage() {
  const { unreviewed } = useSearch({ from: '/app/feedback' })
  const [evidence, retry] = useOperatorResource<readonly OperatorEvidenceCard[]>('/api/operator/evidence')
  const visibleEvidence = evidence.kind === 'ready' && unreviewed ? evidence.data.filter((item) => item.reviewState === 'unreviewed') : evidence.kind === 'ready' ? evidence.data : []
  const empty = evidence.kind === 'ready' && visibleEvidence.length === 0
  return (
    <>
      <OperatorPageHeader eyebrow="Evidence inbox" title="Review the evidence before it becomes a roadmap promise." art={empty || evidence.kind === 'error' ? null : { note: 'Real feedback builds better products.' }}>Every source remains attributed while the team links it to a decision or records its review reason.</OperatorPageHeader>
      <EvidenceRecorder onSaved={retry} />
      <section className="mt-4" aria-labelledby="evidence-list-heading">
        <h2 id="evidence-list-heading" className="sr-only">Evidence items</h2>
        {unreviewed ? <p className="mb-4 text-base font-semibold text-penny-muted">Showing evidence that is awaiting review.</p> : null}
        {evidence.kind === 'loading' ? <OperatorResourceLoading label="Loading evidence…" /> : null}
        {evidence.kind === 'session_expired' ? <OperatorSessionExpired /> : null}
        {evidence.kind === 'not_found' ? <OperatorResourceNotFound title="Evidence inbox unavailable">This workspace evidence route is not available.</OperatorResourceNotFound> : null}
        {evidence.kind === 'error' ? <OperatorResourceFailure title="We could not load evidence." status={evidence.status} onRetry={retry} /> : null}
        {empty ? <OperatorEmpty title={unreviewed ? 'No evidence is awaiting review.' : 'No evidence has been recorded.'}>{unreviewed ? 'All recorded evidence currently has a review state.' : 'Recorded sales, support, interview, email, and portal signals will appear here.'}</OperatorEmpty> : null}
        {evidence.kind === 'ready' ? <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">{visibleEvidence.map((item) => <EvidenceCard key={item.id} evidence={item} onSaved={retry} />)}</div> : null}
      </section>
    </>
  )
}
