import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {reviewFailureHint} from './failure-hint'
import type {ReviewMetadata} from './types'
export function ReviewEvidence({id,review}:{id:string;review:ReviewMetadata}){
 const [proposals,reload]=useOperatorResource<{id:string;problem:string;span:string;start_byte:number;end_byte:number;closest_request_id:string|null;closest_request_slug:string|null}[]>('/api/operator/evidence/'+encodeURIComponent(id)+'/review-proposals')
 return <div className="mt-4 space-y-3 break-words">
 {review.title?<h3 className="font-semibold">{review.title}</h3>:null}
 <p>{review.rating===null?'Rating not supplied':`Rating: ${review.rating}`} {review.version?`· App version: ${review.version}`:''} {review.country?`· Country: ${review.country}`:''}</p>
 <a className="inline-flex min-h-11 items-center underline" href={review.url} target="_blank" rel="noreferrer">Open original review</a>
 <p>Source: {review.sourceState}</p><p>Reviewer is a source name only. Never emailed.</p>
 {review.checkFailure?<p role="status">{reviewFailureHint(review.checkFailure)}</p>:null}
 <h3 className="font-semibold">Suggested requests</h3><p>Extraction: {review.aiState}</p>{review.aiFailure?<p role="status">{reviewFailureHint(review.aiFailure)}</p>:null}
 {proposals.kind==='ready'?<ul className="space-y-3">{proposals.data.map(p=><li className="border-l-2 border-penny-line pl-3" key={p.id}><p className="font-semibold">{p.problem}</p><blockquote className="whitespace-pre-wrap">{p.span}</blockquote><p className="text-sm text-penny-muted">Quoted from the captured review. Use the evidence actions below to create or link a request.</p>{p.closest_request_slug?<a className="inline-flex min-h-11 items-center underline" href={'/app/requests/'+encodeURIComponent(p.closest_request_slug)}>Closest existing request</a>:null}</li>)}</ul>:<button type="button" className="underline min-h-11" onClick={reload}>Load review suggestions</button>}
 </div>
}
