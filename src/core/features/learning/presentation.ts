import type {Observation} from './schema'
import type {LearningConfiguration} from './configuration'
import {observationOriginal,humanFields,citationRanges,sourceUrl} from './source-content'
import {jsonStringSpans} from './json-spans'
import {sourceLabel} from '@/core/app/ui/operator-format'

export interface CitationView {observationId:string;sourceLabel:string;observedAt:string;href:string|null;linkLabel:string;kind:'verbatim'|'structured-excerpt'|'metadata';excerpts:{label:string;quote:string}[]}
type Citation={observationId:string;start:number;end:number;quote:string}
export function citationView(c:Citation,o:Observation,configured?:LearningConfiguration['orbit']):CitationView{
 const original=JSON.parse(o.original_json),decoded=observationOriginal(o)
 const view:CitationView={observationId:o.id,sourceLabel:'Original evidence',observedAt:o.observed_at,href:null,linkLabel:'Open original feedback',kind:'verbatim',excerpts:[]}
 if(decoded){
  const e=decoded.envelope,raw=JSON.parse(e.text),fields=humanFields(e.target,raw),kind=e.target.split('/')[0]
  view.sourceLabel=fields.find(field=>['title','name','subject'].includes(field.path.at(-1)!))?.value??({opportunities:'Orbit opportunity',signals:'Orbit signal',contacts:'Orbit contact',companies:'Orbit company'}[kind]??'Orbit record')
  const origin=decoded.sourceOrigin??(configured?.installationId===e.installationId?configured.origin:null)
  view.href=origin?sourceUrl(e.canonicalUrl,origin,e.target):null;view.linkLabel=kind==='opportunities'?'Open Orbit opportunity':'Open Orbit records'
  if(decoded.normalized){const field=citationRanges(o).find(r=>c.start>=r.start&&c.end<=r.end);if(field)view.excerpts=[{label:field.label,quote:c.quote}]}
  else if(e.text===o.wording){
   const spans=jsonStringSpans(o.wording)
   view.excerpts=fields.flatMap(field=>{const span=spans.get(JSON.stringify(field.path));return span&&span.start>=c.start&&span.end<=c.end?[{label:field.label,quote:field.value}]:[]})
   view.kind=view.excerpts.length?'structured-excerpt':'metadata'
  }
 }else{
  view.sourceLabel=o.evidence_id?sourceLabel(String(original.source_type??'free_text'),typeof original.source_label==='string'?original.source_label:null):typeof original.title==='string'?original.title:'Native feedback'
  if(o.evidence_id)view.href=`/app/feedback?item=${encodeURIComponent(o.evidence_id)}#evidence-${encodeURIComponent(o.evidence_id)}`
  else if(o.request_id&&typeof original.slug==='string')view.href=`/app/moderation#request-${encodeURIComponent(original.slug)}`
  view.excerpts=[{label:'Original wording',quote:c.quote}]
 }
 if(!view.excerpts.length)view.kind='metadata'
 return view
}
export function observationView(o:Observation,configured?:LearningConfiguration['orbit']){
 const decoded=observationOriginal(o)
 if(decoded?.normalized){
  const ranges=citationRanges(o),views=ranges.map(r=>citationView({observationId:o.id,start:r.start,end:r.end,quote:o.wording.slice(r.start,r.end)},o,configured))
  if(views.length)return {...views[0],excerpts:views.flatMap(v=>v.excerpts)}
 }
 return citationView({observationId:o.id,start:0,end:o.wording.length,quote:o.wording},o,configured)
}
export function artifactPresentation(body:{citations:Citation[];contradictions:Citation[]},observations:Observation[],configured?:LearningConfiguration['orbit']){
 const map=(c:Citation)=>{const o=observations.find(o=>o.id===c.observationId);return o?citationView(c,o,configured):null}
 return {citations:body.citations.map(map).filter(v=>v!==null),contradictions:body.contradictions.map(map).filter(v=>v!==null)}
}
