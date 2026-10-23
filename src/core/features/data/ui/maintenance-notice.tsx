import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {StatusLine} from './status-line'

export const dataChangesPause='Data changes pause until you finish or abort the export.'

export function DataMaintenanceNotice() {
 const [maintenance]=useOperatorResource<{exporting:boolean}>('/api/operator/data/maintenance')
 return maintenance.kind==='ready'&&maintenance.data.exporting
  ? <StatusLine className="mb-6" status={{kind:'working',text:dataChangesPause}}/>
  : null
}
