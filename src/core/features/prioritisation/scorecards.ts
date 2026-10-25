import {z} from 'zod'
import {MutationError} from '@/core/app/operator-mutations'
import {createUlid} from '@/core/shared/ulid'
import {audit} from '../decisions/write-support'
import {comparisonRows} from './rows'
import {compareRows} from './formulas'
export const scorecardInput=z.object({name:z.string().trim().min(1).max(120),entity:z.enum(['requests','features']),criteria:z.array(z.object({name:z.string().trim().min(1).max(120),scale:z.union([z.literal(5),z.literal(10)]),weight:z.number().finite().positive().max(1000)}).strict()).min(1).max(20)}).strict()
export const scoreInput=z.object({ideaId:z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/),version:z.number().int().positive(),values:z.array(z.number().int().min(1).max(10)).min(1).max(20)}).strict()
type Definition=z.infer<typeof scorecardInput>
export interface Scorecard {id:string;name:string;entity:'requests'|'features';revision:number}
export interface Scorer {name:string;own:boolean;values:number[];weighted:number}
export interface ScorecardResult extends Scorecard {versions:{version:number;criteria:Definition['criteria'];ideas:{id:string;title:string;score:number|null;scorers:Scorer[]}[]}[]}
export async function listScorecards(db:D1Database){return (await db.prepare('SELECT id,name,entity,revision FROM penny_scorecards ORDER BY name,id').all<Scorecard>()).results}
export async function readScorecard(db:D1Database,id:string,actor:string):Promise<ScorecardResult>{
 const card=await db.prepare('SELECT id,name,entity,revision FROM penny_scorecards WHERE id=?').bind(id).first<Scorecard>()
 if(!card)throw new MutationError(404,'Scorecard not found.')
 const versions=(await db.prepare('SELECT version,criteria_json FROM penny_scorecard_versions WHERE card_id=? ORDER BY version DESC').bind(id).all<{version:number;criteria_json:string}>()).results
 const ideas=await comparisonRows(db,card.entity)
 const scores=(await db.prepare(`SELECT s.id,s.version,s.idea_id,s.scorer_id,CASE WHEN s.scorer_id IS NULL OR p.email LIKE '%@erased.invalid' THEN 'a removed operator' ELSE p.display_name END name FROM penny_scorecard_scores s LEFT JOIN operators p ON p.id=s.scorer_id WHERE s.card_id=? ORDER BY s.created_at,s.id`).bind(id).all<{id:string;version:number;idea_id:string;scorer_id:string|null;name:string}>()).results
 const inputs=(await db.prepare('SELECT i.score_id,i.criterion_index,i.value FROM penny_scorecard_inputs i JOIN penny_scorecard_scores s ON s.id=i.score_id WHERE s.card_id=? ORDER BY i.criterion_index').bind(id).all<{score_id:string;criterion_index:number;value:number}>()).results
 return {...card,versions:versions.map(version=>{
  const criteria=scorecardInput.shape.criteria.parse(JSON.parse(version.criteria_json))
  // Archived ideas retain their original inputs even if the source idea is removed.
  const source=[...ideas,...scores.filter(s=>s.version===version.version&&!ideas.some(row=>row.id===s.idea_id)).map(s=>({id:s.idea_id,title:'Removed idea'}))].filter((row,index,all)=>all.findIndex(other=>other.id===row.id)===index)
  return {version:version.version,criteria,ideas:source.map(idea=>{
   const scorers=scores.filter(s=>s.version===version.version&&s.idea_id===idea.id).map(s=>{
    const values=inputs.filter(input=>input.score_id===s.id).map(input=>input.value)
    return {name:s.name,own:s.scorer_id===actor,values,weighted:criteria.reduce((sum,c,index)=>sum+c.weight*values[index],0)/criteria.reduce((sum,c)=>sum+c.weight,0)}
   })
   return {id:idea.id,title:idea.title,score:scorers.length?scorers.reduce((sum,s)=>sum+s.weighted,0)/scorers.length:null,scorers}
  }).sort(compareRows)}
 })}
}
export async function saveScorecard(db:D1Database,id:string|null,input:Definition,actor:string,now:string,revision?:number){
 const key=id??createUlid(),version=id?(revision??0)+1:1
 if(id){const current=await db.prepare('SELECT revision,entity FROM penny_scorecards WHERE id=?').bind(id).first<Scorecard>();if(!current)throw new MutationError(404,'Scorecard not found.');if(current.revision!==revision||current.entity!==input.entity)throw new MutationError(409,'This scorecard changed. Reload before saving.')}
 try{await db.batch([
  ...(id?[db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM penny_scorecards WHERE id=? AND revision=?) THEN 1 ELSE json('scorecard_stale') END").bind(key,revision!)]:[]),
  id?db.prepare('UPDATE penny_scorecards SET name=?,revision=?,updated_at=? WHERE id=?').bind(input.name,version,now,key):db.prepare('INSERT INTO penny_scorecards(id,name,entity,revision,created_at,updated_at) VALUES(?,?,?,1,?,?)').bind(key,input.name,input.entity,now,now),
  db.prepare('INSERT INTO penny_scorecard_versions(card_id,version,criteria_json,created_at) VALUES(?,?,?,?)').bind(key,version,JSON.stringify(input.criteria),now),
  audit(db,actor,'scorecard',key,id?'scorecard.updated':'scorecard.created',now),
 ])}catch(error){if(/scorecard_stale|UNIQUE constraint/.test(String(error)))throw new MutationError(409,'This scorecard changed. Reload before saving.');throw error}
 return {id:key}
}
export async function scoreIdea(db:D1Database,id:string,input:z.infer<typeof scoreInput>,actor:string,now:string){
 const card=await readScorecard(db,id,actor),current=card.versions.find(v=>v.version===card.revision)!
 if(input.version!==card.revision)throw new MutationError(409,'Criteria changed. Reload before scoring.')
 if(!current.ideas.some(row=>row.id===input.ideaId))throw new MutationError(404,'Idea not found.')
 if(input.values.length!==current.criteria.length||input.values.some((value,index)=>value>current.criteria[index].scale))throw new MutationError(400,'A score is outside its criterion scale.')
 const prior=await db.prepare('SELECT id FROM penny_scorecard_scores WHERE card_id=? AND version=? AND idea_id=? AND scorer_id=?').bind(id,input.version,input.ideaId,actor).first<string>('id'),key=prior??createUlid()
 try{await db.batch([
  db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM penny_scorecards WHERE id=? AND revision=?) THEN 1 ELSE json('scorecard_stale') END").bind(id,input.version),
  prior?db.prepare('UPDATE penny_scorecard_scores SET updated_at=? WHERE id=? AND scorer_id=?').bind(now,key,actor):db.prepare('INSERT INTO penny_scorecard_scores(id,card_id,version,idea_id,scorer_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(key,id,input.version,input.ideaId,actor,now,now),
  db.prepare('DELETE FROM penny_scorecard_inputs WHERE score_id=?').bind(key),
  ...input.values.map((value,index)=>db.prepare('INSERT INTO penny_scorecard_inputs(score_id,criterion_index,value) VALUES(?,?,?)').bind(key,index,value)),
  audit(db,actor,'scorecard',id,'scorecard.scored',now),
 ])}catch(error){if(/scorecard_stale|UNIQUE constraint/.test(String(error)))throw new MutationError(409,'This scorecard changed. Reload before scoring.');throw error}
 return {saved:true}
}
