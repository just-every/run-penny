import {canonical,type Row} from '../data/archive'
import {digest,NativeError} from '../auth/native-tokens'
import {validateLearning} from './validation'
import {outputSchema,type Observation} from './schema'
export async function validateLearningArchive(data:Record<string,Row[]>){
 const observations=data.learning_observations??[]
 for(const row of observations){
  if(await digest(String(row.wording))!==row.content_hash)throw new NativeError('learning_archive_original_invalid',400)
  const eventHash=await digest(String(row.event_key))
  if(data.learning_erased_events?.some(e=>e.event_hash===eventHash))throw new NativeError('learning_archive_erased_event',400)
  for(const person of data.learning_source_people?.filter(p=>p.observation_id===row.id)??[]){const personHash=await digest(`${data.learning_sources.find(s=>s.id===row.source_id)?.provider}:${data.learning_sources.find(s=>s.id===row.source_id)?.installation_id}:person:${person.source_person_id}`);if(data.learning_erased_people?.some(e=>e.person_hash===personHash))throw new NativeError('learning_archive_erased_person',400)}
 }
 for(const artifact of data.learning_artifacts??[]){
  const inputIds=new Set(data.learning_contributions.filter(c=>c.artifact_id===artifact.id).map(c=>c.observation_id)),inputs=observations.filter(o=>inputIds.has(o.id))
  try{
   const body=JSON.parse(String(artifact.body_json)),output=outputSchema.parse({...body,options:body.options.map((option:Record<string,unknown>)=>Object.fromEntries(Object.entries(option).filter(([key])=>!['affectedRequesters','affectedAccounts','unlinkedObservations','supportingEvidenceCount','latestObservedAt','contradictingEvidence'].includes(key))))})
   if(canonical(validateLearning(output,inputs as unknown as Observation[],Number.MAX_SAFE_INTEGER))!==canonical(body))throw new Error('derived-dimensions')
   if(inputs.some(o=>o.investigation_id!==artifact.investigation_id))throw new Error('cross-investigation')
  }catch{throw new NativeError('learning_archive_derived_invalid',400)}
 }
 for(const commitment of data.learning_commitments??[]){
  const artifact=data.learning_artifacts.find(a=>a.id===commitment.artifact_id)
  if(!artifact)throw new NativeError('learning_archive_commitment_invalid',400)
  const snapshot=JSON.parse(String(commitment.snapshot_json))
  if(snapshot.interpretationId!==artifact.id||snapshot.interpretationVersion!==artifact.version||!Array.isArray(snapshot.observations)||snapshot.observations.some((o:Observation)=>!observations.some(row=>row.id===o.id&&row.wording===o.wording)))throw new NativeError('learning_archive_commitment_invalid',400)
 }
}
