import {NativeError} from '../auth/native-tokens'
import type {Row} from '../data/archive'
import {definitionInput,validScores,type Definition} from './input'
/** Archives retain score history, never operator sessions or scorer authority. */
export function validateScorecardArchive(data:Record<string,Row[]>):void {
 try{
  const versions=new Map<string,Definition>()
  for(const row of data.penny_scorecard_versions??[])versions.set(String(row.id),definitionInput.parse({name:row.name,criteria:JSON.parse(String(row.criteria_json))}))
  for(const row of data.penny_scorecard_scores??[]){
   const definition=versions.get(String(row.version_id)),inputs=JSON.parse(String(row.inputs_json)) as unknown
   if(!definition||!inputs||typeof inputs!=='object'||Array.isArray(inputs)||!validScores(definition,inputs as Record<string,number>))throw new Error('Invalid score inputs')
  }
 }catch{throw new NativeError('scorecard_archive_invalid',409)}
}
