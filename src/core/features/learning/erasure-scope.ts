import type {Row} from '../data/archive'

/** These columns are cleared transactionally by learningErasureStatements.
 * Treat them as redactions instead of deleting an entire grant and its unrelated
 * original evidence merely because its private configuration copied a subject. */
export function learningErasedScopes(data:Record<string,Row[]>,selected:Record<string,Row[]>){
 const evidence=new Set((selected.evidence_items??[]).map(row=>row.id)),requests=new Set((selected.requests??[]).map(row=>row.id)),investigations=new Set((selected.learning_observations??[]).map(row=>row.investigation_id))
 for(const row of data.learning_investigations??[])if((JSON.parse(String(row.native_evidence_ids_json)) as string[]).some(id=>evidence.has(id))||(JSON.parse(String(row.native_request_ids_json)) as string[]).some(id=>requests.has(id)))investigations.add(row.id)
 return investigations
}
export function learningRedactions(data:Record<string,Row[]>,selected:Record<string,Row[]>){
 const investigations=learningErasedScopes(data,selected)
 const sources=new Set((data.learning_investigations??[]).filter(row=>investigations.has(row.id)).map(row=>row.source_id))
 return (table:string,row:Row,column:string)=>table==='learning_investigations'&&investigations.has(row.id)&&['question','purpose','native_evidence_ids_json','native_request_ids_json'].includes(column)||table==='learning_sources'&&sources.has(row.id)&&['name','use_basis'].includes(column)||table==='learning_runs'&&investigations.has(row.investigation_id)&&column==='cursor_json'
}
