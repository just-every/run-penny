import {lexicalTerms} from '../../requests/suggestions'
import type {DraftSource} from '../draft-context'
import {NativeError} from '../../auth/native-tokens'
import {askPrivacy} from './privacy'

/** Same current native-operator read boundary as AI-006; no embeddings. */
export async function askContext(db:D1Database,question:string,role:string){
 const privacy=await askPrivacy(db,role),terms=lexicalTerms(privacy.clean(question)).filter(t=>!['private','context','withheld'].includes(t)).slice(0,40)
 if(!terms.length)throw new NativeError('ai_question_needs_terms',422,'Ask a question with a few specific words from your customer feedback.')
 const tokens=JSON.stringify(terms),sources:DraftSource[]=[]
 const score=(text:string)=>`(SELECT count(*) FROM json_each(?) t WHERE instr(lower(${text}),t.value)>0)`
 const requests=await db.prepare(`SELECT id,slug,title,description,${score("title||' '||description")} score FROM requests WHERE merged_into_request_id IS NULL AND withdrawn_at IS NULL ORDER BY score DESC,id LIMIT 12`).bind(tokens).all<{id:string;slug:string;title:string;description:string;score:number}>()
 for(const r of requests.results)if(r.score)sources.push({id:`request:${r.id}`,text:privacy.clean(JSON.stringify({title:r.title,description:r.description})),label:'Request',href:`/app/moderation?item=${encodeURIComponent(r.id)}`})
 const evidence=await db.prepare(`SELECT e.id evidence_id,v.id,v.wording,e.observed_at,${score('v.wording')} score FROM evidence_items e JOIN evidence_versions v ON v.evidence_id=e.id WHERE v.version_number=(SELECT max(version_number) FROM evidence_versions WHERE evidence_id=e.id) ORDER BY score DESC,e.id LIMIT 12`).bind(tokens).all<{id:string;evidence_id:string;wording:string;observed_at:string;score:number}>()
 for(const e of evidence.results)if(e.score)sources.push({id:`evidence:${e.id}`,text:privacy.clean(JSON.stringify({wording:e.wording,observedAt:e.observed_at})),label:'Stored evidence version',href:`/api/operator/evidence/${e.evidence_id}/versions`})
 if(privacy.includePrivate){
  const fields=privacy.commercial?',revenue_cents,renewal_date,health':''
  const accounts=await db.prepare(`SELECT id,slug,name${fields},${score('name')} score FROM accounts ORDER BY score DESC,id LIMIT 12`).bind(tokens).all<{id:string;slug:string;name:string;score:number;revenue_cents?:number;renewal_date?:string;health?:string}>()
  // Also retrieve accounts attached to lexical evidence, without searching commercial fields.
  const linked=await db.prepare(`SELECT DISTINCT a.id,a.slug,a.name${privacy.commercial?',a.revenue_cents,a.renewal_date,a.health':''} FROM accounts a JOIN evidence_items e ON e.account_id=a.id JOIN evidence_versions v ON v.evidence_id=e.id WHERE v.id IN(SELECT value FROM json_each(?)) LIMIT 12`).bind(JSON.stringify(evidence.results.filter(e=>e.score).map(e=>e.id))).all<{id:string;slug:string;name:string;revenue_cents?:number;renewal_date?:string;health?:string}>()
  const selected=new Map([...accounts.results.filter(a=>a.score),...linked.results].map(a=>[a.id,a]))
  for(const a of selected.values())sources.push({id:`account:${a.id}`,text:privacy.clean(JSON.stringify({name:a.name,...(privacy.commercial?{revenueCents:a.revenue_cents,renewalDate:a.renewal_date,health:a.health}:{})})),label:'Account context',href:`/app/customers/${encodeURIComponent(a.slug)}`})
 }
 if(!sources.length)throw new NativeError('ai_no_permitted_context',409,'No matching permitted records were found. Try words from your stored feedback.')
 if(JSON.stringify(sources).length>100000)throw new NativeError('ai_context_too_large',413,'The matching records are too large for one answer. Ask a more specific question.')
 return {sources,privacy,question:privacy.clean(question)}
}
