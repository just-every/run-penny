import {sourceEvent,sourcePerson} from './erasure-fences'
import {canonical,type Row} from '../data/archive'
import {digest,NativeError} from '../auth/native-tokens'
import {validateLearning} from './validation'
import {comparableDimensions} from './archive-dimensions'
import {outputSchema,type Observation,type Source} from './schema'
import {validateObservation} from './source-content'
export async function validateLearningArchive(data:Record<string,Row[]>){
 const observations=data.learning_observations??[]
 for(const source of data.learning_sources??[]){
  let targets:string[]
  try{targets=JSON.parse(String(source.resource_ids_json));if(!Array.isArray(targets)||targets.some(target=>typeof target!=='string'))throw new Error()}catch{throw new NativeError('learning_archive_source_invalid',400)}
  for(const target of targets){
   const eventHash=await digest(sourceEvent(String(source.provider),source.installation_id as string|null,target)),personHash=target.startsWith('contacts/')?await digest(sourcePerson(String(source.provider),source.installation_id as string|null,target.slice(9))):''
   if(data.learning_erased_events?.some(row=>row.event_hash===eventHash)||data.learning_erased_people?.some(row=>row.person_hash===personHash))throw new NativeError('learning_archive_erased_source',400)
  }
 }
 for(const row of observations){
  let rawPeople:string[]
  try{rawPeople=await validateObservation(row as unknown as Observation,data.learning_sources.find(s=>s.id===row.source_id) as unknown as Source)}catch{throw new NativeError('learning_archive_original_invalid',400)}
  const eventHash=await digest(String(row.event_key))
  if(data.learning_erased_events?.some(e=>e.event_hash===eventHash))throw new NativeError('learning_archive_erased_event',400)
  for(const person of [...(data.learning_source_people?.filter(p=>p.observation_id===row.id)??[]),...(row.source_person_id?[{source_person_id:row.source_person_id}]:[]),...rawPeople.map(source_person_id=>({source_person_id}))]){const personHash=await digest(`${data.learning_sources.find(s=>s.id===row.source_id)?.provider}:${data.learning_sources.find(s=>s.id===row.source_id)?.installation_id}:person:${person.source_person_id}`);if(data.learning_erased_people?.some(e=>e.person_hash===personHash))throw new NativeError('learning_archive_erased_person',400)}
 }
 for(const run of data.learning_runs??[]){
  let cursor:unknown
  try{cursor=JSON.parse(String(run.cursor_json))}catch{throw new NativeError('learning_archive_cursor_invalid',400)}
  if(Array.isArray(cursor))for(const item of cursor){if(!item||typeof item.eventKey!=='string'||typeof item.contentHash!=='string')throw new NativeError('learning_archive_cursor_invalid',400);const eventHash=await digest(item.eventKey);if(data.learning_erased_events?.some(row=>row.event_hash===eventHash))throw new NativeError('learning_archive_erased_event',400)}
  else if(canonical(cursor)!=='{}')throw new NativeError('learning_archive_cursor_invalid',400)
 }
 for(const artifact of data.learning_artifacts??[]){
  const inputIds=new Set(data.learning_contributions.filter(c=>c.artifact_id===artifact.id).map(c=>c.observation_id)),inputs=observations.filter(o=>inputIds.has(o.id))
  try{
   const body=JSON.parse(String(artifact.body_json)),output=outputSchema.parse({...body,options:body.options.map((option:Record<string,unknown>)=>Object.fromEntries(Object.entries(option).filter(([key])=>!['affectedRequesters','affectedAccounts','unlinkedObservations','supportingEvidenceCount','latestObservedAt','contradictingEvidence'].includes(key))))})
   const derived=validateLearning(output,inputs as unknown as Observation[],Number.MAX_SAFE_INTEGER)
   if(canonical(derived)!==canonical(comparableDimensions(body,derived,inputs as unknown as Observation[])))throw new Error('derived-dimensions')
   if(inputs.some(o=>o.investigation_id!==artifact.investigation_id))throw new Error('cross-investigation')
  }catch{throw new NativeError('learning_archive_derived_invalid',400)}
 }
 for(const commitment of data.learning_commitments??[]){
  const artifact=data.learning_artifacts.find(a=>a.id===commitment.artifact_id)
  if(!artifact)throw new NativeError('learning_archive_commitment_invalid',400)
  const snapshot=JSON.parse(String(commitment.snapshot_json)),interpreted=JSON.parse(String(artifact.body_json))
  if(snapshot.interpretationId!==artifact.id||snapshot.interpretationVersion!==artifact.version||canonical({...snapshot.interpretation,protocol:interpreted.protocol})!==canonical(interpreted)||canonical(snapshot.interpretation?.protocol)!==canonical(snapshot.protocol)||!Array.isArray(snapshot.observations)||snapshot.observations.some((o:Observation)=>!observations.some(row=>row.id===o.id&&canonical(row)===canonical(o))))throw new NativeError('learning_archive_commitment_invalid',400)
 }
}
