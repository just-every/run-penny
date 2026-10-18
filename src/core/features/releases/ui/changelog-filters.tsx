import {useId} from 'react'
import type { CurrentPublicRelease } from '../public-read-repository'
import { inputClass,fieldLabelClass } from '@/core/ui/app/classes'
export function ChangelogFilters({releases,label,product,onLabel,onProduct}:{releases:readonly CurrentPublicRelease[];label:string;product:string;onLabel:(value:string)=>void;onProduct:(value:string)=>void}){
 const labelId=useId(),productId=useId()
 const labels=new Map(releases.flatMap(release=>release.labels).map(item=>[item.id,item.name]))
 const products=new Map(releases.flatMap(release=>release.products).map(item=>[item.id,item.name]))
 return <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className={fieldLabelClass}><span id={labelId}>Filter by label</span><select aria-labelledby={labelId} value={label} onChange={event=>onLabel(event.target.value)} className={`mt-2 ${inputClass}`}><option value="">All labels</option><option value="new">New</option><option value="improved">Improved</option><option value="fixed">Fixed</option>{[...labels].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label className={fieldLabelClass}><span id={productId}>Filter by product</span><select aria-labelledby={productId} value={product} onChange={event=>onProduct(event.target.value)} className={`mt-2 ${inputClass}`}><option value="">All products</option>{[...products].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label></div>
}
export function ChangelogLabels({release}:{release:CurrentPublicRelease}){
 return <>{release.labels.map(label=><span key={label.id} className="rounded-full bg-penny-sand px-3 py-1 text-sm font-semibold text-penny-ink">{label.name}</span>)}</>
}
