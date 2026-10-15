import { DecisionCreate } from './decision-actions'
import { useSearch } from '@tanstack/react-router'
import type { OperatorDecisionListItem } from '@/core/shared/api/operator'
import { OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { useOperatorList, ListControls } from '@/core/features/workspace/ui/list-controls'
import { OperatorEmpty, OperatorResourceFailure, OperatorResourceLoading, OperatorResourceNotFound, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { DecisionRow } from './decision-row'

export function DecisionsQueuePage() {
  const { attention } = useSearch({ from: '/app/decisions' })
  const [decisions, retry, page] = useOperatorList<OperatorDecisionListItem>('/api/operator/decisions')
  const visibleDecisions = decisions.kind === 'ready' && attention ? decisions.data.filter((decision) => decision.state === 'ready' || decision.state === 'review_due') : decisions.kind === 'ready' ? decisions.data : []
  const empty = decisions.kind === 'ready' && visibleDecisions.length === 0
  return <><OperatorPageHeader eyebrow="Decision queue" title="Make the trade-off visible before you commit." art={empty || decisions.kind === 'error' ? null : { note: 'Good decisions compound.' }}>A decision stays visible through commitment and review so its outcome can teach the next one.</OperatorPageHeader><ListControls page={page} entity="decisions"/><DecisionCreate onSaved={retry}/><section className="mt-4" aria-labelledby="decision-queue-heading"><h2 id="decision-queue-heading" className="sr-only">Decisions</h2>{attention ? <p className="mb-4 text-base font-semibold text-penny-muted">Showing ready and review-due decisions.</p> : null}{decisions.kind === 'loading' ? <OperatorResourceLoading label="Loading decisions…" /> : null}{decisions.kind === 'session_expired' ? <OperatorSessionExpired /> : null}{decisions.kind === 'not_found' ? <OperatorResourceNotFound title="Decision queue unavailable">This workspace decisions route is not available.</OperatorResourceNotFound> : null}{decisions.kind === 'error' ? <OperatorResourceFailure title="We could not load decisions." status={decisions.status} message={decisions.message} onRetry={retry} /> : null}{empty ? <OperatorEmpty note="What do we build next?" title={attention ? 'No decisions need attention.' : 'No decisions have been recorded.'}>{attention ? 'Ready and review-due decisions will appear here.' : 'A decision appears when a product question is ready for accountable review.'}</OperatorEmpty> : null}{decisions.kind === 'ready' ? <div className="space-y-4">{visibleDecisions.map((decision) => <DecisionRow key={decision.slug} decision={decision} />)}</div> : null}</section></>
}
