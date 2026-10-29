import { OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { RequesterDirectory } from '@/core/features/workspace/ui/requester-directory'
import { CustomerViewSwitch } from './customer-view-switch'

export function RequestersPage() {
  return <><OperatorPageHeader eyebrow="Account context" title="See who is asking.">Identity and linked feedback remain private to operators.</OperatorPageHeader><CustomerViewSwitch current="requesters"/><RequesterDirectory/></>
}
