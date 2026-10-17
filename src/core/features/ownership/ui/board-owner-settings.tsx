import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { SettingsSection } from '../../requests/ui/settings-catalog'
import type { OwnershipCatalog } from '../types'
import { OwnerAssignmentForm, ownershipChanged } from './owner-control'

export function BoardOwnerSettings() {
 const [resource, refresh] = useOperatorResource<OwnershipCatalog>('/api/operator/ownership/catalog')
 return <SettingsSection id="settings-owners" icon="board" title="Capture ownership">
  <p className="mb-4 text-sm text-penny-muted">A board's default owner takes new requests and evidence captured on that board. Changing a default keeps existing assignments. Ownership is private.</p>
  {resource.kind === 'loading' ? <p className="text-sm text-penny-muted">Loading capture owners…</p> : null}
  {resource.kind !== 'loading' && resource.kind !== 'ready' ? <p role="alert" className="text-sm text-penny-danger">Could not load capture owners. <button type="button" className="underline" onClick={refresh}>Try again</button></p> : null}
  {resource.kind === 'ready' && resource.data.boards.length === 0 ? <p className="text-sm text-penny-muted">Create a board to set its capture owner.</p> : null}
  {resource.kind === 'ready' ? <div className="grid min-w-0 gap-4 lg:grid-cols-2">{resource.data.boards.map(board => <OperatorCard key={board.id} className="p-5"><h3 className="font-bold text-penny-ink">{board.name}</h3><OwnerAssignmentForm entity="boards" value={board.slug} owner={board.owner} operators={resource.data.operators} onSaved={() => { refresh(); ownershipChanged() }} /></OperatorCard>)}</div> : null}
 </SettingsSection>
}
