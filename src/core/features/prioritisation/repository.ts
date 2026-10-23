import {readScorecard} from './scorecard-repository'
import {MutationError} from '@/core/app/operator-mutations'
import {createUlid} from '@/core/shared/ulid'
import {audit} from '../decisions/write-support'
import {comparisonRows} from './rows'
import {sortRows,viewInput,type ViewInput,type EvaluatedRow} from './formulas'
export interface SavedView {id:string;ownerId:string;owned:boolean;revision:number;view:ViewInput}
export interface ViewResult extends SavedView {rows:EvaluatedRow[]}
interface Stored {id:string;owner_id:string;revision:number;definition_json:string}
export async function listViews(db:D1Database,actor:string):Promise<SavedView[]>{
 const rows=await db.prepare('SELECT id,owner_id,revision,definition_json FROM penny_priority_views WHERE owner_id=? OR shared=1 ORDER BY name,id').bind(actor).all<Stored>()
 return rows.results.map(row=>decode(row,actor))
}
function decode(row:Stored,actor:string):SavedView{return {id:row.id,ownerId:row.owner_id,owned:row.owner_id===actor,revision:row.revision,view:viewInput.parse(JSON.parse(row.definition_json))}}
export async function readView(db:D1Database,id:string,actor:string):Promise<ViewResult>{
 const row=await db.prepare('SELECT id,owner_id,revision,definition_json FROM penny_priority_views WHERE id=? AND (owner_id=? OR shared=1)').bind(id,actor).first<Stored>()
 if(!row)throw new MutationError(404,'View not found.')
 const saved=decode(row,actor)
 const rows=await comparisonRows(db,saved.view.entity)
 if(saved.view.scorecardId){const card=await readScorecard(db,saved.view.scorecardId,actor,false);if(card.entity!==saved.view.entity)throw new MutationError(422,'The scorecard compares a different kind of idea.');for(const row of rows)row.scorecardTotal=card.rows.find(result=>result.id===row.id)?.score??null}
 return {...saved,rows:sortRows(rows,saved.view)}
}
export async function saveView(db:D1Database,id:string|null,view:ViewInput,actor:string,now:string,revision?:number){
 if(view.formula==='scorecard'&&!view.scorecardId)throw new MutationError(422,'Choose a scorecard for this formula.')
 if(view.scorecardId){const card=await readScorecard(db,view.scorecardId,actor,false);if(card.entity!==view.entity)throw new MutationError(422,'The scorecard compares a different kind of idea.')}
 const key=id??createUlid()
 if(id){
  const row=await db.prepare('SELECT owner_id,revision FROM penny_priority_views WHERE id=?').bind(id).first<{owner_id:string;revision:number}>()
  if(!row||row.owner_id!==actor)throw new MutationError(404,'Your view was not found.')
  if(row.revision!==revision)throw new MutationError(409,'This view changed. Reload before saving.')
 }
 // Revision admission shares the write transaction, including races after the read.
 const definition=JSON.stringify(view)
 try{await db.batch([
  ...(id?[db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM penny_priority_views WHERE id=? AND owner_id=? AND revision=?) THEN 1 ELSE json('priority_stale_revision') END").bind(key,actor,revision!)]:[]),
  id?db.prepare('UPDATE penny_priority_views SET name=?,shared=?,definition_json=?,revision=revision+1,updated_at=? WHERE id=?').bind(view.name,Number(view.shared),definition,now,key):db.prepare('INSERT INTO penny_priority_views(id,owner_id,name,shared,definition_json,revision,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)').bind(key,actor,view.name,Number(view.shared),definition,now,now),
  audit(db,actor,'prioritisation_view',key,id?'prioritisation_view.updated':'prioritisation_view.created',now),
 ])}catch(error){if(String(error).includes('priority_stale_revision'))throw new MutationError(409,'This view changed. Reload before saving.');throw error}
 return {id:key}
}
