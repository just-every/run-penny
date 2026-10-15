import type { DeliveryCounts as Counts } from '../counts'
import { DataField } from '@/core/ui/app/DataField'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'

/** Penny Dev and demos record a send without emailing anyone; say so instead of "sent". */
export function useMailSuppressed(): boolean {
  const [capabilities] = usePublicResource<{ transport: string }>('/api/auth/capabilities')
  return capabilities.kind === 'ready' && capabilities.data.transport === 'development'
}

export function DeliveryCounts({counts}:{counts:Counts}){
  const suppressed=useMailSuppressed()
  return <><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:grid-cols-3 xl:grid-cols-2" aria-label="Email delivery counts">{(['queued','sent','suppressed','failed','unknown','delivered'] as const).map(key=><DataField key={key} label={suppressed&&key==='sent'?'not emailed (local)':key} valueClassName="text-lg font-bold tabular-nums">{counts[key]}</DataField>)}</dl>
  {suppressed?<p className="mt-3 text-sm leading-6 text-penny-muted">This copy sends no email. Messages are recorded as they would be sent, but nobody receives them.</p>:null}</>
}
