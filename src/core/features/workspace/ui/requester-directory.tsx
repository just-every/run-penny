import { CustomFieldsEditor } from '@/core/features/settings/ui/custom-fields-editor'
import { RequesterBlockControl } from '@/core/features/requests/ui/requester-block-control'
import { ListControls, useOperatorList } from './list-controls'
import type { OperatorRequesterCard } from '../paged-service'
import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { OperatorResourceFailure, OperatorResourceLoading, OperatorSessionExpired, OperatorEmpty } from '@/core/app/ui/operator-resource-state'
export function RequesterDirectory() {
  const [state, retry, page] = useOperatorList<OperatorRequesterCard>('/api/operator/requesters')
  return (
    <section aria-label="Requester directory">
      <ListControls entity="requesters" page={page} />
      {state.kind === 'loading' ? <OperatorResourceLoading label="Loading requesters…" /> : null}
      {state.kind === 'session_expired' ? <OperatorSessionExpired /> : null}
      {state.kind === 'error' || state.kind === 'not_found' ? <OperatorResourceFailure title="Could not load requesters." onRetry={retry} /> : null}
      {state.kind === 'ready' && state.data.length === 0 ? <OperatorEmpty title="No requesters match these filters.">Change the search or tag to see other requesters.</OperatorEmpty> : null}
      {state.kind === 'ready' ? (
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          {state.data.map(row => (
            <OperatorCard key={row.id} id={`requesters-${row.id}`} className="min-w-0 p-5">
              <h3 className="break-words text-xl font-bold">{row.displayName}</h3>
              <p className="mt-2 break-all text-penny-muted">{row.email ?? 'No email address'}</p>
              <RequesterBlockControl requester={row} onSaved={retry} />
              <CustomFieldsEditor entityType="requester" entityId={row.id} />
            </OperatorCard>
          ))}
        </div>
      ) : null}
    </section>
  )
}
