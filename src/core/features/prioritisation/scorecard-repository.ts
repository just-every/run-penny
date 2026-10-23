import {MutationError} from '@/core/app/operator-mutations'
import {createUlid} from '@/core/shared/ulid'
import {audit} from '../decisions/write-support'
import {comparisonRows} from './rows'
import {sortRows,viewInput} from './formulas'
import {weightedResult,type Scorecard,type ScorecardInput,type ScoreVersion,type ScorerInput} from './scorecard-model'
export async function listScorecards(db:D1Database){return (await db.prepare('SELECT id,name,entity,revision FROM penny_scorecards ORDER BY name,id').all<Scorecard>()).results}
export async function readScorecard(db:D1Database,id:string,actor:string,canDefine:boolean){
 const card=await db.prepare('SELECT id,name,entity,revision FROM penny_scorecards WHERE id=?').bind(id).first<Scorecard>()
 if(!card)throw new MutationError(404,'Scorecard not found.')
 const versions=(await db.prepare('SELECT id,revision,criteria_json FROM penny_scorecard_versions WHERE scorecard_id=? ORDER BY revision DESC').bind(id).all<{id:string;revision:number;criteria_json:string}>()).results.map(v=>({id:v.id,revision:v.revision,criteria:JSON.parse(v.criteria_json)} as ScoreVersion))
 const inputs=(await db.prepare(`SELECT s.id,s.idea_id,s.version_id,a.operator_id,o.display_name,i.criterion_index,i.value FROM penny_score_submissions s JOIN penny_scorecard_versions v ON v.id=s.version_id JOIN penny_score_inputs i ON i.submission_id=s.id LEFT JOIN penny_score_scorers a ON a.submission_id=s.id LEFT JOIN operators o ON o.id=a.operator_id WHERE v.scorecard_id=? ORDER BY s.id,i.criterion_index`).bind(id).all<{id:string;idea_id:string;version_id:string;operator_id:string|null;display_name:string|null;criterion_index:number;value:number}>()).results
 const grouped=new Map<string,ScorerInput>()
 for(const input of inputs){let row=grouped.get(input.id);if(!row){row={id:input.id,ideaId:input.idea_id,versionId:input.version_id,scorer:input.display_name??'a removed operator',own:input.operator_id===actor,values:[],result:0};grouped.set(input.id,row)}row.values[input.criterion_index]=input.value}
 const submissions=[...grouped.values()].map(s=>({...s,result:weightedResult(versions.find(v=>v.id===s.versionId)!.criteria,s.values)}))
 const rows=(await comparisonRows(db,card.entity)).map(row=>{const current=submissions.filter(s=>s.ideaId===row.id&&s.versionId===versions[0].id);return {...row,scorecardTotal:current.length?current.reduce((sum,s)=>sum+s.result,0)/current.length:null}})
 return {...card,canDefine,versions,submissions,rows:sortRows(rows,viewInput.parse({name:card.name,formula:'scorecard'}))}
}
export async function saveScorecard(db:D1Database,id:string|null,input:ScorecardInput,actor:string,now:string,revision?:number){
 if(id){const current=await db.prepare('SELECT revision,entity FROM penny_scorecards WHERE id=?').bind(id).first<{revision:number;entity:string}>();if(!current)throw new MutationError(404,'Scorecard not found.');if(current.revision!==revision||current.entity!==input.entity)throw new MutationError(409,'This scorecard changed. Reload before saving.')}
 const key=id??createUlid(),version=createUlid()
 // Immutable versions make stale criterion submissions fail in the transaction.
 try{await db.batch([
  ...(id?[db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM penny_scorecards WHERE id=? AND revision=? AND entity=?) THEN 1 ELSE json('scorecard_stale_revision') END").bind(key,revision!,input.entity)]:[]),
  id?db.prepare('UPDATE penny_scorecards SET name=?,revision=revision+1,updated_at=? WHERE id=?').bind(input.name,now,key):db.prepare('INSERT INTO penny_scorecards VALUES(?,?,?,1,?,?)').bind(key,input.name,input.entity,now,now),
  db.prepare('INSERT INTO penny_scorecard_versions SELECT ?,id,revision,?,? FROM penny_scorecards WHERE id=?').bind(version,JSON.stringify(input.criteria),now,key),
  audit(db,actor,'scorecard',key,id?'scorecard.criteria_revised':'scorecard.created',now),
 ])}catch(error){if((String(error).includes('scorecard_stale_revision')||String(error).includes('malformed JSON')))throw new MutationError(409,'This scorecard changed. Reload before saving.');throw error}
 return {id:key}
}
export async function saveScores(db:D1Database,cardId:string,ideaId:string,versionId:string,values:number[],actor:string,now:string){
 const card=await readScorecard(db,cardId,actor,false),version=card.versions[0]
 if(version.id!==versionId)throw new MutationError(409,'The criteria changed. Reload before scoring.')
 if(!card.rows.some(row=>row.id===ideaId))throw new MutationError(404,'Idea not found.')
 if(values.length!==version.criteria.length||values.some((value,index)=>value>version.criteria[index].scale))throw new MutationError(422,'Every criterion needs a score within its scale.')
 const previous=card.submissions.find(s=>s.own&&s.ideaId===ideaId&&s.versionId===versionId),key=previous?.id??createUlid()
 try{await db.batch([
  db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM penny_scorecards c JOIN penny_scorecard_versions v ON v.scorecard_id=c.id AND v.revision=c.revision WHERE c.id=? AND v.id=?) THEN 1 ELSE json('scorecard_stale_revision') END").bind(cardId,versionId),
  // One submission per operator/idea/version, including a racing first save.
  db.prepare("SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM penny_score_submissions s JOIN penny_score_scorers a ON a.submission_id=s.id WHERE s.version_id=? AND s.idea_id=? AND a.operator_id=? AND s.id!=?) THEN 1 ELSE json('scorecard_stale_revision') END").bind(versionId,ideaId,actor,key),
  ...(previous?[db.prepare('UPDATE penny_score_submissions SET updated_at=? WHERE id=?').bind(now,key),db.prepare('DELETE FROM penny_score_inputs WHERE submission_id=?').bind(key)]:[db.prepare('INSERT INTO penny_score_submissions VALUES(?,?,?,?,?)').bind(key,versionId,ideaId,now,now),db.prepare('INSERT INTO penny_score_scorers VALUES(?,?)').bind(key,actor)]),
  ...values.map((value,index)=>db.prepare('INSERT INTO penny_score_inputs VALUES(?,?,?)').bind(key,index,value)),
  audit(db,actor,'score_submission',key,'scorecard.scored',now),
 ])}catch(error){if((String(error).includes('scorecard_stale_revision')||String(error).includes('malformed JSON')))throw new MutationError(409,'The scorecard changed. Reload before saving.');throw error}
 return {saved:true}
}
