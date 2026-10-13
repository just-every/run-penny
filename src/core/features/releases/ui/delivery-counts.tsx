import type { DeliveryCounts as Counts } from '../counts'
import { DataField } from '@/core/ui/app/DataField'
export function DeliveryCounts({counts}:{counts:Counts}){return <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:grid-cols-3 xl:grid-cols-2" aria-label="Email delivery counts">{(['queued','sent','suppressed','failed','unknown','delivered'] as const).map(key=><DataField key={key} label={key} valueClassName="text-lg font-bold tabular-nums">{counts[key]}</DataField>)}</dl>}
