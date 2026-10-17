import { useEffect, useState } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { fieldLabelClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { operatorMutation } from '../../requests/ui/operator-client'
import type { ItemOwner, OwnedEntity, OwnershipOperator } from '../types'

export function ownershipChanged() { window.dispatchEvent(new Event('penny-ownership-changed')) }

export function OwnerControl({ entity, value, onSaved }: { entity: OwnedEntity; value: string; onSaved?: () => void }) {
 const [resource, refresh] = useOperatorResource<{ owner: ItemOwner | null; operators: OwnershipOperator[] }>(`/api/operator/ownership/${entity}/${encodeURIComponent(value)}`)
 if (resource.kind === 'loading') return <p className="mt-4 text-sm text-penny-muted">Loading owner…</p>
 if (resource.kind !== 'ready') return <p role="alert" className="mt-4 text-sm text-penny-danger">Could not load ownership. <button type="button" className="underline" onClick={refresh}>Try again</button></p>
 return <OwnerAssignmentForm entity={entity} value={value} owner={resource.data.owner} operators={resource.data.operators} onSaved={() => { refresh(); onSaved?.(); ownershipChanged() }} />
}

export function OwnerAssignmentForm({ entity, value, owner, operators, onSaved }: { entity: OwnedEntity; value: string; owner: ItemOwner | null; operators: OwnershipOperator[]; onSaved: () => void }) {
 const [selected, setSelected] = useState(owner?.id ?? ''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [failed, setFailed] = useState(false)
 useEffect(() => { setSelected(owner?.id ?? '') }, [owner?.id])
 const label = entity === 'boards' ? 'Default owner on capture' : 'Accountable owner'
 return <form className="mt-4 space-y-3 border-t border-penny-line pt-4" aria-label={label} onSubmit={async event => {
  event.preventDefault(); setBusy(true); setMessage(''); setFailed(false)
  try { await operatorMutation(`/api/operator/ownership/${entity}/${encodeURIComponent(value)}`, { operatorId: selected || null }, 'PATCH'); setMessage('Owner saved.'); onSaved() }
  catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Could not save owner.') }
  finally { setBusy(false) }
 }}>
  <label className={fieldLabelClass}>{label}<select className={fieldClass} value={selected} onChange={event => setSelected(event.target.value)}>
   <option value="">Unassigned</option>
   {owner && !operators.some(operator => operator.id === owner.id) ? <option value={owner.id} disabled>{owner.displayName} (inactive)</option> : null}
   {operators.map(operator => <option key={operator.id} value={operator.id}>{operator.displayName}</option>)}
  </select></label>
  {owner && !owner.active ? <p className="text-sm text-penny-muted">The recorded owner is inactive. Assign an active operator to resume follow-up.</p> : null}
  <button className={secondaryButtonClass} disabled={busy || selected === (owner?.id ?? '')}>{busy ? 'Saving…' : 'Save owner'}</button>
  <p role={failed ? 'alert' : 'status'} className={`text-sm empty:hidden ${failed ? 'text-penny-danger' : 'text-penny-moss'}`}>{message}</p>
 </form>
}
