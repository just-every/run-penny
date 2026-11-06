import {NativeError} from '../auth/native-tokens'
import {definitionInput} from './input'

const criteria=(text:string)=>definitionInput.shape.criteria.parse(JSON.parse(text))
/** Criterion IDs and numeric inputs describe the scoring schema, not copied
 * wording. Only the human criterion names participate in wording erasure. */
export function scorecardCopyWords(table:string,column:string,text:string):string[]|undefined {
 if(table==='penny_scorecard_versions'&&column==='criteria_json')return criteria(text).map(c=>c.name)
 if(table==='penny_scorecard_scores'&&column==='inputs_json')return []
}
export function redactScorecardCopy(table:string,column:string,text:string,redact:(text:string)=>string):string {
 if(table!=='penny_scorecard_versions'||column!=='criteria_json')return redact(text)
 return JSON.stringify(criteria(text).map(c=>({...c,name:redact(c.name)})))
}
/** A reviewed rename can change wording, never rewrite retained scoring
 * structure or detach existing inputs from their original criterion. */
export function checkScorecardCopy(table:string,current:Record<string,string>,next:Record<string,string>):void {
 if(table!=='penny_scorecard_versions')return
 try{
  if('name' in next)definitionInput.shape.name.parse(next.name)
  if('criteria_json' in next){
   const before=criteria(current.criteria_json),after=criteria(next.criteria_json)
   const structure=(items:typeof before)=>items.map(({key,scale,weight})=>({key,scale,weight}))
   if(JSON.stringify(structure(before))!==JSON.stringify(structure(after)))throw new Error('Changed scoring structure')
  }
 }catch{throw new NativeError('erasure_scorecard_invalid',409)}
}
