import { Buffer } from 'node:buffer'
import { readFileSource } from '../../../../base/modules/import-kit/src/readers/index.ts'
import { safeValue } from '../../../../base/modules/import-kit/src/readers/records.ts'
import { parseJson } from '../../../../base/modules/import-kit/src/readers/json.ts'
import { sha256 } from '../../../../base/modules/import-kit/src/provenance/identity.ts'
import type { Json, ParsedRecord, SourceBundle } from '../../../../base/modules/import-kit/src/types.ts'
import { NativeError } from '../auth/native-tokens'
import { parseFeedbackCsv, feedbackCsvTags } from './csv'
import { feedbackKinds, importBounds, type SavedFeedbackInput, type FeedbackSource } from './types'
import { ideasRows,FeedbackSourceError } from './ideas'
import { uservoiceIdeas,uservoiceVoters } from './uservoice'
import {internalStatusRecords} from './internal-statuses'
import { feedbackBoardPolicySchema } from './board-policy'

const object = (value: Json): Record<string,Json> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('SOURCE_OBJECT'); return value }
export async function readSavedFeedback(input: SavedFeedbackInput): Promise<FeedbackSource> {
 const bundle: SourceBundle = { records: [], artifacts: [], diagnostics: [] }; let bytes = 0
 if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(input.namespace) || !input.files.length || input.files.length > 30) throw new NativeError('feedback_source_invalid',400)
 const names = new Set<string>()
 for (const file of input.files) {
  if (!feedbackKinds.includes(file.kind) || names.has(file.name) || !/^[a-zA-Z0-9_. -]{1,100}$/.test(file.name)) throw new NativeError('feedback_file_invalid',400)
  names.add(file.name)
  const original = Buffer.from(file.base64,'base64'); bytes += original.byteLength
  if(original.toString('base64')!==file.base64)throw new NativeError('feedback_base64_invalid',400)
  if(original.byteLength>importBounds.bytes)throw new NativeError(`Saved file ${file.name} has ${original.byteLength} bytes; the per-file limit is ${importBounds.bytes} bytes. No history was applied.`,413)
  if(bytes>importBounds.sourceBytes)throw new NativeError(`Saved source has ${bytes} bytes; the bundle limit is ${importBounds.sourceBytes} bytes. No history was applied.`,413)
  const uservoice = file.version.startsWith('uservoice-')
  const format = ['classic-csv','ideas-csv'].includes(file.version) || uservoice ? 'csv' : 'json'
  const version = file.kind === 'merges' ? 'relationships-v1' : ['users','votes','comments'].includes(file.kind) ? 'v2' : 'v1'
  if (format === 'csv' ? (file.version === 'uservoice-voters-csv' ? file.kind !== 'votes' || file.boardId !== undefined : file.kind !== 'posts' || !file.boardId) : file.version !== version) throw new NativeError('feedback_format_unsupported',422)
  if (file.tagMapping && !['classic-csv','ideas-csv'].includes(file.version)) throw new NativeError('feedback_format_unsupported',422)
  if(file.ideas&&file.version!=='ideas-csv')throw new NativeError('feedback_format_unsupported',422)
  if(uservoice?!file.uservoice?.scope:file.uservoice)throw new FeedbackSourceError(uservoice?`Declare ${file.name}'s UserVoice export scope as complete or filtered in its uservoice settings.`:'UserVoice settings belong only to UserVoice files.',[file.name])
  let content = original
  let collectionPointer = ''
  if (format === 'csv') {
   // Workbooks are zip (xlsx) or compound (xls) files, never UTF-8 text.
   if(/\.xls[xm]?$/i.test(file.name)||original.subarray(0,4).equals(Buffer.from([0x50,0x4b,0x03,0x04]))||original.subarray(0,4).equals(Buffer.from([0xd0,0xcf,0x11,0xe0])))throw new FeedbackSourceError(`${file.name} is a spreadsheet workbook, not CSV. Open it in your spreadsheet app, save it as "CSV UTF-8 (Comma delimited)" (.csv), then prepare the source again.`,[])
   let headings:string[]=[]
   const values = parseFeedbackCsv(new TextDecoder('utf-8',{fatal:true}).decode(original),found=>{headings=found}); safeValue(values)
   if(file.version==='classic-csv')for(const row of values)for(const field of ['Score (Total Votes)','Comment Count','Company Count','Associated MRR'])if(field in row&&row[field]!==''&&(!/^\d+(?:\.\d+)?$/.test(row[field])||!Number.isFinite(Number(row[field]))||field!=='Associated MRR'&&!Number.isSafeInteger(Number(row[field]))))throw new FeedbackSourceError('Invalid aggregate number in heading '+field,[field])
   content = Buffer.from(JSON.stringify(file.version==='ideas-csv'?ideasRows(values,file.ideas,headings):file.version==='uservoice-ideas-csv'?uservoiceIdeas(values,file,headings,input.statuses):file.version==='uservoice-voters-csv'?uservoiceVoters(values,file,headings):values.map(row=>({...row,tags:feedbackCsvTags(row.Tags??'',file.tagMapping)}))))
  } else {
   const value = parseJson(new TextDecoder('utf-8',{fatal:true}).decode(original),{artifact:file.name})
   safeValue(value)
   const collection = ['votes','comments'].includes(file.kind) ? 'items' : file.kind
   if (value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value[collection])) {
    content = Buffer.from(JSON.stringify(value[collection])); collectionPointer = '/'+collection
    for (const field of Object.keys(value).filter(key=>key!==collection)) bundle.diagnostics.push({severity:'warning',code:'SOURCE_ENVELOPE_OMISSION',message:'Saved response envelope field is retained without product effects.',kind:file.kind,field,location:{artifact:file.name,pointer:'/'+field}})
    if (value.hasMore === true || value.hasNextPage === true) bundle.diagnostics.push({severity:'warning',code:'PARTIAL_HISTORY',message:'This response declares more history. Save the remaining pages before applying a complete-history import.',kind:file.kind,location:{artifact:file.name}})
   }
  }
  const parse = (value: Json): ParsedRecord[] => {
   const root = object(value), collection = Array.isArray(root[file.kind]) ? root[file.kind] as Json[] : [value]
   return collection.map(item => {
    const payload = object(item)
    if (format === 'csv') {
     if(file.version==='ideas-csv')return {kind:file.kind,sourceId:String(object(payload._idea).key),payload:{...payload,_boardId:file.boardId!,_format:'ideas-csv'}}
     if(uservoice)return {kind:file.kind,sourceId:String(payload.id),payload}
     const sourceId = payload['Post URL']; if (typeof sourceId !== 'string') throw new Error('CSV_POST_URL')
     const url = new URL(sourceId); if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) throw new Error('CSV_POST_URL')
     return {kind:file.kind,sourceId,payload:{...payload,_boardId:file.boardId!,_format:'classic-csv'}}
    }
    if (typeof payload.id !== 'string' || !payload.id) throw new Error('SOURCE_ID')
    return {kind:file.kind,sourceId:payload.id,payload}
   })
  }
  const part = await readFileSource({ namespace:input.namespace,name:file.name,bytes:content,format:'json',parse },{maxBytes:importBounds.sourceBytes,maxRecords:importBounds.records,maxRecordBytes:importBounds.recordBytes}).catch(error=>{
   if(error?.code==='SOURCE_RECORD_LIMIT')throw new NativeError(`Saved file ${file.name} exceeds the ${importBounds.records}-record limit. No history was applied.`,413)
   if(error?.code==='SOURCE_RECORD_BYTE_LIMIT')throw new NativeError(`Saved file ${file.name} contains a record exceeding the ${importBounds.recordBytes}-byte record limit. No history was applied.`,413)
   if(error?.code==='SOURCE_BYTE_LIMIT')throw new NativeError(`Saved file ${file.name} exceeds the ${importBounds.sourceBytes}-byte normalized source limit. No history was applied.`,413)
   throw error
  })
  if (format === 'csv' || collectionPointer) {
   const hash = sha256(original)
   part.artifacts = [{name:file.name,sha256:hash,size:original.byteLength,original:{status:'available',base64:file.base64}}]
   for (const record of part.records) { record.artifactHash = hash; if(collectionPointer) record.location.pointer = collectionPointer+(record.location.pointer??'') }
  }
  bundle.records.push(...part.records); bundle.artifacts.push(...part.artifacts); bundle.diagnostics.push(...part.diagnostics)
 }
 if (input.boards?.length) {
  const metadata = Buffer.from(JSON.stringify(input.boards))
  const part = await readFileSource({namespace:input.namespace,name:'owner-board-mapping.json',bytes:metadata,format:'json',parse:value=>({kind:'boards',sourceId:String(object(value).id),payload:value})})
  for(const record of part.records)record.location.pointer='penny:generated:'+record.location.pointer
  bundle.records.push(...part.records); bundle.artifacts.push(...part.artifacts)
 }
 if(input.boardPolicies){
  const boards=new Set(bundle.records.filter(record=>record.kind==='boards').map(record=>record.sourceId))
  for(const [id,policy] of Object.entries(input.boardPolicies))if(!boards.has(id)||!feedbackBoardPolicySchema.safeParse(policy).success)throw new NativeError('Board policy must name a supplied board and contain every participation and display setting.',422)
 }
 bundle.records.push(...internalStatusRecords(input,bundle.records))
 // Mapping choices are source custody too: replay cannot silently change status
 // or board policy while retaining the same source IDs.
 const mappingChoices = {statuses:input.statuses,...(input.roadmap?{roadmap:input.roadmap}:{}),...(input.internalStatuses?{internalStatuses:input.internalStatuses}:{}),...(input.boardPolicies?{boardPolicies:input.boardPolicies}:{}),...(input.files.some(file=>file.uservoice)?{uservoice:input.files.filter(file=>file.uservoice).map(file=>({name:file.name,options:file.uservoice!}))}:{}),...(input.files.some(file=>file.ideas)?{ideasMappings:input.files.filter(file=>file.ideas).map(file=>({name:file.name,columns:file.ideas!}))}:{}),...(input.files.some(file=>file.tagMapping)?{tagMappings:input.files.filter(file=>file.tagMapping).map(file=>({name:file.name,tags:file.tagMapping!}))}:{})}
 safeValue(mappingChoices)
 const choices = Buffer.from(JSON.stringify(mappingChoices))
 bundle.artifacts.push({name:'penny-mapping.json',sha256:sha256(choices),size:choices.byteLength,original:{status:'available',base64:choices.toString('base64')}})
 if (bundle.records.length > importBounds.records) throw new NativeError(`Saved history has ${bundle.records.length} records; the limit is ${importBounds.records}. No history was applied.`,413)
 return {...bundle,options:input}
}
