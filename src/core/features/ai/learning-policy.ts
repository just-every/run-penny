import {NativeError} from '../auth/native-tokens'
import {humanFields,observationOriginal} from '../learning/source-content'
import type {PrivateValue} from './privacy'
/** Commercial CRM records are not customer quotations. Classify from retained
 * provenance, including account names not copied into Penny's own account table. */
export async function privateLearningInput(db:D1Database,input:unknown){
 if(!input||typeof input!=='object'||!('observations' in input)||!Array.isArray(input.observations))throw new NativeError('ai_context_invalid',409)
 const observations=input.observations as {id:string;citableRanges:unknown[]}[],ids=observations.map(o=>o.id)
 const rows=(await db.prepare("SELECT id,original_json FROM learning_observations WHERE id IN(SELECT value FROM json_each(?)) AND (COALESCE(json_extract(original_json,'$.envelope.target'),json_extract(original_json,'$.target')) LIKE 'companies/%' OR COALESCE(json_extract(original_json,'$.envelope.target'),json_extract(original_json,'$.target')) LIKE 'opportunities/%')").bind(JSON.stringify(ids)).all<{id:string;original_json:string}>()).results
 const excluded=new Set(rows.map(r=>r.id)),permitted=observations.filter(o=>!excluded.has(o.id)),values:PrivateValue[]=[]
 for(const row of rows){const source=observationOriginal(row);if(!source)throw new NativeError('ai_context_invalid',409);for(const field of humanFields(source.envelope.target,JSON.parse(source.envelope.text)))values.push({value:field.value,field:'Commercial source context'})}
 if(!permitted.some(o=>o.citableRanges.length))throw new NativeError('ai_private_context_excluded',409,'The selected evidence contains only private commercial context. Select customer feedback or explicitly allow permitted private context in AI settings.')
 return {input:{...input,observations:permitted,corrections:[]},values}
}
