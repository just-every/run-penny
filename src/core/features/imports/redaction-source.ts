import type {Json} from '../../../../base/modules/import-kit/src/types'
import {canonicalJson,sha256} from '../../../../base/modules/import-kit/src/d1/index'
import {NativeError} from '../auth/native-tokens'
import {redact} from '../redaction/engine'
import type {FeedbackSource} from './types'
import {policyArtifact,policyArtifactName,type ImportRedactionPolicy} from './redaction-policy'

const structural=new Set(['id','key','kind','version','namespace','sourceId','created','updated','created_at','updated_at','status','publicStatus','mapped','scope','_format','_boardId','post','board','voter','parentID','sourcePostId','targetPostId','supporterType','category','sourceValue','file','Date created','Post URL','Post Status','Public Status Name','Created Timestamp','Linked Idea Creation Date'])
/** Redact retained-only cells too. Identity and relationship values must stay
 * exact: rejecting a sensitive key is safer than merging two marked identities. */
export function redactFeedbackSource(source:FeedbackSource,policy:ImportRedactionPolicy):FeedbackSource {
 if(!policy.enabled)return source
 const exact=(value:string)=>{if(redact(value,policy)!==value)throw new NativeError('feedback_redaction_structural_value',422,'A source identifier, timestamp, heading or mapping key matches a redaction rule. Remove that sensitive structural value in the source system before importing.');return value}
 const walk=(value:Json,path:string[]=[],preserve=false):Json=>{
  if(typeof value==='string')return preserve?exact(value):redact(value,policy)
  if(Array.isArray(value))return value.map(item=>walk(item,path,preserve))
  if(!value||typeof value!=='object')return value
  return Object.fromEntries(Object.entries(value).map(([key,item])=>{
   exact(key)
   const reference=key==='author'&&path.at(-1)!=='_idea',identifier=structural.has(key)||/(?:Id|ID)$/.test(key)||/ ID$/.test(key)||key==='tags'
   // Objects used as references still have human names; only their ID remains exact.
   return [key,walk(item,[...path,key],identifier||reference)]
  }))
 }
 try{
  exact(source.options.namespace)
  for(const artifact of source.artifacts){exact(artifact.name);if(policyArtifactName(artifact.name))throw new NativeError('feedback_redaction_reserved_name',422,'Rename the source file: this name is reserved for import privacy custody.')}
  const files=source.options.files.map(file=>({...file,base64:''}))
  const options=walk({...source.options,files} as unknown as Json) as unknown as FeedbackSource['options']
  // Mapping dictionaries and heading selectors must keep the graph a reviewed file names.
  const keys=(value:unknown):void=>{if(typeof value==='string'){exact(value);return}if(Array.isArray(value)){value.forEach(keys);return}if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){exact(key);keys(item)}}
  keys(source.options.statuses);keys(source.options.boardPolicies)
  for(const file of source.options.files){exact(file.name);if(file.boardId)exact(file.boardId);keys(file.ideas);keys(file.tagMapping);if(file.uservoice){keys(file.uservoice.headings);keys(file.uservoice.forums);keys(file.uservoice.omissions)}}
  if(source.options.roadmap)keys(source.options.roadmap.boardIds)
  const records=source.records.map(record=>{
   exact(record.sourceId);exact(record.namespace);exact(record.location.artifact);if(record.location.pointer)exact(record.location.pointer)
   const payload=walk(record.payload)
   return {...record,payload,payloadHash:sha256(canonicalJson(payload))}
  })
  const diagnostics=source.diagnostics.map(issue=>walk(issue as unknown as Json) as unknown as typeof issue)
  return {...source,options,records,diagnostics,artifacts:[...source.artifacts.map(artifact=>({...artifact,original:{status:'unavailable' as const,reason:'not-supplied' as const}})),policyArtifact(policy.revision)]}
 }catch(error){if(error instanceof NativeError)throw error;throw new NativeError('redaction_limit',413,'This saved source exceeds the redaction work limit; nothing was stored.')}
}

/** A prior roadmap settings image is custody, so it cannot be silently edited. */
export function assertPrivateRoadmapSnapshot(before:string,policy:ImportRedactionPolicy):void {
 if(policy.enabled&&redact(before,policy)!==before)throw new NativeError('feedback_redaction_roadmap_snapshot',422,'The current roadmap settings contain text matched by redaction rules. Update those settings before importing a replacement.')
}
