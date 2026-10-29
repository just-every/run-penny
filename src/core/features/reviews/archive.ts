import {z} from 'zod'
import type {Row} from '../data/archive'
import {NativeError,digest} from '../auth/native-tokens'
import {connectionInput,site,publicListing,type Connection} from './configuration'
import {validateReview,pageCursor} from './adapters'
export async function validateReviewArchive(data:Record<string,Row[]>){
 try{
  const connections=new Map((data.penny_review_connections??[]).map(row=>{
   const input=connectionInput.parse({site:row.site,listing:row.listing,publicUrl:row.public_url,termsAccepted:row.terms_accepted===1,intervalHours:row.interval_hours,purgeDays:row.purge_days,extract:row.extract===1})
   if(row.id!==input.site+'/'+input.listing||!['scheduled','running','failed','paused','held','disconnected'].includes(String(row.state))||!Number.isSafeInteger(row.revision)||Number(row.revision)<1)throw Error()
   if(['capterra','trustradius'].includes(input.site)){publicListing(input.site,input.publicUrl);if(!input.termsAccepted)throw Error()}
   z.object({owner_id:z.string().min(1).max(128),owner_version:z.number().int().nonnegative(),actor_id:z.string().min(1).max(128),cursor:z.string().max(2000).nullable(),next_due:z.string().datetime({offset:true}),captured:z.number().int().nonnegative(),attempts:z.number().int().nonnegative()}).parse(row)
   if(![0,1].includes(Number(row.extract))||![0,1].includes(Number(row.terms_accepted)))throw Error()
   if(row.cursor!==null){if(input.site==='producthunt')z.string().min(1).max(1000).parse(row.cursor);else pageCursor(row as unknown as Connection,String(row.cursor))}
   return [row.id,row]
  }))
  const evidence=new Map((data.evidence_items??[]).map(r=>[r.id,r])),versions=new Map((data.evidence_versions??[]).map(r=>[r.id,r])),receipts=new Set((data.penny_review_receipts??[]).map(r=>z.string().regex(/^[a-f0-9]{64}$/).parse(r.source_digest)))
  const sources=new Map((data.penny_review_sources??[]).map(row=>[row.evidence_id,row]))
  for(const s of sources.values()){
   const c=connections.get(String(s.connection_id)),e=evidence.get(s.evidence_id),v=[...versions.values()].find(v=>v.evidence_id===s.evidence_id)
   if(!c||!e||!v||c.site!==s.site||e.source_type!=='review'||e.requester_id!==null||e.admitted_sender!==null||!receipts.has(await digest(s.site+'/'+s.review_id)))throw Error()
   site.parse(s.site);z.string().regex(/^[a-f0-9]{64}$/).parse(s.source_hash)
   if(!['current','changed','removed','purged'].includes(String(s.source_state))||!['pending','running','failed','done','stopped'].includes(String(s.ai_state)))throw Error()
   validateReview(c as unknown as Connection,{id:s.review_id,author:e.named_speaker,rating:s.rating,title:s.title,text:v.wording,date:s.source_date??e.observed_at,version:s.app_version,country:s.country,url:s.review_url})
   if(s.source_state==='purged'&&(e.named_speaker!==null||s.title!==null||[...versions.values()].some(v=>v.evidence_id===s.evidence_id&&v.wording!=='[Source removed]')))throw Error()
  }
  for(const p of data.penny_review_proposals??[]){
   const s=sources.get(p.evidence_id),v=versions.get(p.version_id),start=z.number().int().nonnegative().parse(p.start_byte),end=z.number().int().positive().parse(p.end_byte)
   if(!s||!v||v.evidence_id!==p.evidence_id||s.source_state==='purged')throw Error()
   const bytes=new TextEncoder().encode(String(v.wording))
   if(start>=end||end>bytes.length||new TextDecoder('utf-8',{fatal:true}).decode(bytes.slice(start,end))!==p.span)throw Error()
   z.string().min(1).max(1000).parse(p.problem)
  }
 }catch{throw new NativeError('reviews_archive_invalid',409)}
}
