import {MutationError} from '@/core/app/operator-mutations'
import {createUlid} from '@/core/shared/ulid'
import {audit} from '../decisions/write-support'
import {definitionInput,validScores,type Definition} from './input'
import {rankRequests,type RequestRow,type ScoreRow} from './ranking'
interface StoredVersion {id:string;scorecard_id:string;version:number;name:string;criteria_json:string;created_by:string;created_at:string}
const definition=(v:StoredVersion)=>definitionInput.parse({name:v.name,criteria:JSON.parse(v.criteria_json)})
export async function listScorecards(db:D1Database){
 return (await db.prepare('SELECT v.id versionId,v.scorecard_id id,v.version,v.name FROM penny_scorecard_versions v WHERE v.version=(SELECT MAX(n.version) FROM penny_scorecard_versions n WHERE n.scorecard_id=v.scorecard_id) ORDER BY v.name,v.scorecard_id').all()).results
}
export async function readScorecard(db:D1Database,id:string,versionId?:string){
 const versions=(await db.prepare('SELECT * FROM penny_scorecard_versions WHERE scorecard_id=? ORDER BY version DESC').bind(id).all<StoredVersion>()).results
 const selected=versionId?versions.find(v=>v.id===versionId):versions[0]
 if(!selected)throw new MutationError(404,'Scorecard version not found.')
 // One read batch gives criteria-specific inputs and the request set from the
 // same snapshot. Withdrawn or merged requests retain historical score readback.
 const result=await db.batch([
  db.prepare('SELECT r.id,r.slug,r.title FROM requests r WHERE (r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL) OR EXISTS(SELECT 1 FROM penny_scorecard_scores s WHERE s.version_id=? AND s.request_id=r.id) ORDER BY r.id').bind(selected.id),
  db.prepare('SELECT s.*,o.display_name FROM penny_scorecard_scores s JOIN operators o ON o.id=s.operator_id WHERE s.version_id=? ORDER BY s.operator_id,s.request_id').bind(selected.id),
 ])
 return {id,currentVersionId:versions[0].id,versions:versions.map(v=>({id:v.id,version:v.version,name:v.name})),version:{id:selected.id,version:selected.version,...definition(selected),createdBy:selected.created_by,createdAt:selected.created_at},rows:rankRequests(definition(selected),result[0].results as unknown as RequestRow[],result[1].results as unknown as ScoreRow[])}
}
const fresh=(db:D1Database,id:string,versionId:string)=>db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM penny_scorecard_versions v WHERE v.id=? AND v.scorecard_id=? AND v.version=(SELECT MAX(n.version) FROM penny_scorecard_versions n WHERE n.scorecard_id=?)) THEN 1 ELSE json('scorecard_stale_version') END").bind(versionId,id,id)
async function assertCurrent(db:D1Database,id:string,versionId:string){
 const current=await db.prepare('SELECT id FROM penny_scorecard_versions WHERE scorecard_id=? ORDER BY version DESC LIMIT 1').bind(id).first<{id:string}>()
 if(current?.id!==versionId)throw new MutationError(409,'The scorecard changed. Select its current version.')
}
async function commit(db:D1Database,statements:D1PreparedStatement[],id?:string,versionId?:string){
 if(id&&versionId)await assertCurrent(db,id,versionId)
 try{await db.batch(statements)}catch(error){
  // SQLite reports an aborted expression as malformed JSON. Re-read the
  // version after rollback to classify a concurrent revision without hiding
  // an unrelated storage or audit failure.
  if(id&&versionId)await assertCurrent(db,id,versionId)
  throw error
 }
}
export async function saveDefinition(db:D1Database,id:string|null,input:Definition,actor:string,now:string,previousVersionId?:string){
 const key=id??createUlid(),versionId=createUlid()
 if(id){
  const card=await db.prepare('SELECT created_by FROM penny_scorecards WHERE id=?').bind(id).first<{created_by:string}>()
  if(!card||card.created_by!==actor)throw new MutationError(404,'Your scorecard was not found.')
 }
 await commit(db,[
  ...(id?[fresh(db,id,previousVersionId!)]:[db.prepare('INSERT INTO penny_scorecards(id,created_by,created_at) VALUES(?,?,?)').bind(key,actor,now)]),
  db.prepare('INSERT INTO penny_scorecard_versions(id,scorecard_id,version,name,criteria_json,created_by,created_at) SELECT ?,?,COALESCE(MAX(version),0)+1,?,?,?,? FROM penny_scorecard_versions WHERE scorecard_id=?').bind(versionId,key,input.name,JSON.stringify(input.criteria),actor,now,key),
  audit(db,actor,'scorecard',key,id?'scorecard.revised':'scorecard.created',now,{versionId}),
 ],id??undefined,previousVersionId)
 return {id:key,versionId}
}
export async function saveScores(db:D1Database,id:string,requestId:string,versionId:string,inputs:Record<string,number>,actor:string,now:string){
 const version=await db.prepare('SELECT * FROM penny_scorecard_versions WHERE id=? AND scorecard_id=?').bind(versionId,id).first<StoredVersion>()
 if(!version)throw new MutationError(404,'Scorecard version not found.')
 if(!validScores(definition(version),inputs))throw new MutationError(400,'Scores must use the version criteria and their declared scales.')
 if(!await db.prepare('SELECT id FROM requests WHERE id=? AND withdrawn_at IS NULL AND merged_into_request_id IS NULL').bind(requestId).first())throw new MutationError(404,'Request not found.')
 await commit(db,[
  fresh(db,id,versionId),
  db.prepare('INSERT INTO penny_scorecard_scores(version_id,request_id,operator_id,inputs_json,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(version_id,request_id,operator_id) DO UPDATE SET inputs_json=excluded.inputs_json,updated_at=excluded.updated_at').bind(versionId,requestId,actor,JSON.stringify(inputs),now,now),
  audit(db,actor,'scorecard',id,'scorecard.scored',now,{versionId,requestId}),
 ],id,versionId)
}
