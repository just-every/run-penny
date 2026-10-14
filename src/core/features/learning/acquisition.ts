import {assertSourceTargets} from './erasure-fences'
import {NativeError,digest} from '../auth/native-tokens'
import {canonical} from '../data/archive'
import type {PennyRuntime} from '@/core/app/runtime'
import type {Investigation,Source,Observation} from './schema'
import {readOrbit,type SourceRecord} from './ports'
import {assertScope} from './authority'
export interface Captured extends SourceRecord {requesterId:string|null;accountId:string|null;evidenceId:string|null;requestId:string|null;nativeGuard?:{sql:string;params:(string|number|null)[]}}
export async function acquire(runtime:PennyRuntime,db:D1Database,i:Investigation,s:Source):Promise<Captured[]>{
 const result:Captured[]=[]
 for(const id of JSON.parse(i.native_evidence_ids_json) as string[]){
  const row=await db.prepare('SELECT e.*,v.id version_id,v.wording FROM evidence_items e JOIN evidence_versions v ON v.evidence_id=e.id WHERE e.id=? ORDER BY v.version_number DESC LIMIT 1').bind(id).first<Record<string,string|null>>()
  if(!row)throw new NativeError('learning_native_evidence_missing',409)
  result.push({eventKey:`native:evidence:${id}`,wording:row.wording!,original:row,observedAt:row.observed_at!,people:[],requesterId:row.requester_id,accountId:row.account_id,evidenceId:id,requestId:null,nativeGuard:{sql:'(SELECT id FROM evidence_versions WHERE evidence_id=? ORDER BY version_number DESC LIMIT 1)=?',params:[id,row.version_id]}})
 }
 for(const id of JSON.parse(i.native_request_ids_json) as string[]){
  const row=await db.prepare('SELECT * FROM requests WHERE id=?').bind(id).first<Record<string,string|null>>()
  if(!row)throw new NativeError('learning_native_request_missing',409)
  result.push({eventKey:`native:request:${id}`,wording:row.title+'\n'+row.description,original:row,observedAt:row.created_at!,people:[],requesterId:row.author_requester_id??null,accountId:null,evidenceId:null,requestId:id,nativeGuard:{sql:'EXISTS(SELECT 1 FROM requests WHERE id=? AND title=? AND description=?)',params:[id,row.title,row.description]}})
 }
 if(s.provider==='orbit')for(const target of JSON.parse(s.resource_ids_json) as string[]){
  await assertScope(runtime.database.binding,i,s)
  await assertSourceTargets(db,s.provider,s.installation_id,[target])
  result.push({...await readOrbit(runtime,target,s.installation_id),requesterId:null,accountId:null,evidenceId:null,requestId:null})
 }
 if(!result.length)throw new NativeError('learning_evidence_required',409)
 return result
}
export async function retain(db:D1Database,i:Investigation,s:Source,records:Captured[]):Promise<Observation[]>{
 const observations:Observation[]=[]
 for(const record of records){
  const eventHash=await digest(record.eventKey),people=await Promise.all(record.people.map(id=>digest(`${s.provider}:${s.installation_id}:person:${id}`)))
  const erased=await db.prepare('SELECT 1 FROM learning_erased_events WHERE event_hash=? UNION ALL SELECT 1 FROM learning_erased_people WHERE person_hash IN(SELECT value FROM json_each(?)) LIMIT 1').bind(eventHash,JSON.stringify(people)).first()
  if(erased)throw new NativeError('learning_source_erased',409)
  const contentHash=await digest(record.wording),now=new Date().toISOString(),id=crypto.randomUUID()
  const guards=record.nativeGuard?[db.prepare(`INSERT INTO penny_integration_guards(id,allowed) VALUES(?,(${record.nativeGuard.sql}))`).bind(id,...record.nativeGuard.params)]:[]
  await db.batch([...guards,db.prepare("UPDATE learning_artifacts SET state='contested' WHERE id IN(SELECT c.artifact_id FROM learning_contributions c JOIN learning_observations o ON o.id=c.observation_id WHERE o.investigation_id=? AND o.event_key=? AND o.content_hash<>?)").bind(i.id,record.eventKey,contentHash),db.prepare(`INSERT OR IGNORE INTO learning_observations(id,investigation_id,source_id,event_key,content_hash,wording,original_json,observed_at,source_person_id,requester_id,account_id,evidence_id,request_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,i.id,s.id,record.eventKey,contentHash,record.wording,canonical(record.original),record.observedAt,record.people[0]??null,record.requesterId,record.accountId,record.evidenceId,record.requestId,now),...record.people.map(person=>db.prepare('INSERT OR IGNORE INTO learning_source_people(observation_id,source_person_id) SELECT id,? FROM learning_observations WHERE investigation_id=? AND event_key=? AND content_hash=?').bind(person,i.id,record.eventKey,contentHash)),...(record.nativeGuard?[db.prepare('DELETE FROM penny_integration_guards WHERE id=?').bind(id)]:[])])
  const saved=(await db.prepare('SELECT * FROM learning_observations WHERE investigation_id=? AND event_key=? AND content_hash=?').bind(i.id,record.eventKey,contentHash).first<Observation>())!
  observations.push(saved)
 }
 return observations
}
