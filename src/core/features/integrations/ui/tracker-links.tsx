import {useOperatorResource} from '@/core/app/ui/operator-resource'
import { formatMoment } from '@/core/app/ui/operator-format'
import {TrackerActions} from './tracker-actions'
export function TrackerLinks({requestId}:{requestId:string}) {
 const [resource,reload]=useOperatorResource<{links:{id:string;provider:string;issue_url:string;state:string;source_updated_at:number}[]}>('/api/operator/integrations/trackers/request/'+requestId)
 return <section className="my-5" data-rer-private=""><h3 className="font-bold">Linked tracker evidence</h3><p className="my-2">Tracker receipts do not change Penny’s status or publish an update.</p>
 {resource.kind==='ready'?<ul className="space-y-3">{resource.data.links.map(link=><li key={link.id}><a className="break-all underline" href={link.issue_url} target="_blank" rel="noopener noreferrer">{link.provider} issue</a><p className="break-words">{link.state}{link.source_updated_at?' · '+formatMoment(link.source_updated_at):''}</p></li>)}</ul>:resource.kind==='loading'?<p>Loading tracker receipts…</p>:<><p role="alert">Tracker receipts could not be loaded.</p><button className="min-h-11 underline" onClick={reload}>Retry tracker receipts</button></>}
 <TrackerActions requestId={requestId} reload={reload}/></section>
}
