import { canonicalJson, sha256 } from '../../../../base/modules/import-kit/src/d1/index.ts'
import type { SourceRecord } from '../../../../base/modules/import-kit/src/types.ts'
import type { FeedbackSource } from './types'
import { cannyMergeRecords } from './canny-history'
import { asObject, reference, sourceText, sourceTime } from './mapping-support'

export function feedbackGraph(source: FeedbackSource) {
 const records = [...source.records, ...cannyMergeRecords(source.records)], users = new Map(records.filter(r=>r.kind==='users').map(r=>[r.sourceId,r]))
 for (const record of records) {
  const payload = asObject(record.payload),idea=payload._format==='ideas-csv'?asObject(payload._idea):null
  const csvAuthor=idea?idea.author:payload._format==='classic-csv'?payload['Post Author']:null
  // UserVoice names its creator by the source's own user ID, shared with votes.
  const creator=payload._format==='uservoice-ideas-csv'?asObject(payload._uservoice).author:undefined
  if(creator&&!users.has(reference(creator))) {
   const value=asObject(creator);sourceText(value.name,'historical author',200);sourceTime(value.created)
   users.set(reference(value),{...record,location:{...record.location,pointer:'penny:generated:'+record.location.pointer},kind:'users',sourceId:reference(value),payload:value,payloadHash:sha256(canonicalJson(value))})
  }
  if(record.kind==='posts'&&csvAuthor) {
   const value={id:'csv-author:'+record.sourceId,name:sourceText(csvAuthor,'historical author',200),created:sourceTime(idea?idea.created:payload['Date created'])}
   users.set(value.id,{...record,location:{...record.location,pointer:'penny:generated:'+record.location.pointer},kind:'users',sourceId:value.id,payload:value,payloadHash:sha256(canonicalJson(value))})
  }
  for (const name of record.kind==='votes'?['voter']:!idea&&['posts','comments'].includes(record.kind)?['author']:[]) {
   const value = payload[name]
   if (value && typeof value === 'object' && !Array.isArray(value) && !users.has(reference(value))) {
    sourceText(value.name,'historical contributor name',200); sourceTime(value.created)
    const entry: SourceRecord = {...record,location:{...record.location,pointer:'penny:generated:'+record.location.pointer},kind:'users',sourceId:reference(value),payload:value,payloadHash:sha256(canonicalJson(value))}
    users.set(entry.sourceId,entry)
   }
  }
 }
 const byKind = (kind:string) => new Map(records.filter(r=>r.kind===kind).map(r=>[r.sourceId,r]))
 const posts = byKind('posts'), boards = byKind('boards'), tags = byKind('tags'), comments = byKind('comments'), merges = byKind('merges')
 const parents = new Map<string,string>(), unresolved:{kind:string;sourceId:string;field:string;target:string}[]=[]
 const missing=(record:SourceRecord,field:string,target:string)=>{unresolved.push({kind:record.kind,sourceId:record.sourceId,field,target})}
 for (const merge of merges.values()) {
  const p=asObject(merge.payload), from=reference(p.sourcePostId),to=reference(p.targetPostId)
  if(!posts.has(from))missing(merge,'sourcePostId',from)
  if(!posts.has(to))missing(merge,'targetPostId',to)
  if(!posts.has(from)||!posts.has(to))continue
  if(parents.has(from))throw new Error('Repeated merge source')
  parents.set(from,to)
 }
 const root = (id:string):string => { const seen=new Set<string>();let current=id;while(parents.has(current)){if(seen.has(current))throw new Error('Merge cycle');seen.add(current);current=parents.get(current)!}return current }
 for(const id of parents.keys()) root(id)
 const boardId = (r:SourceRecord)=>{const p=asObject(r.payload);return reference(p._format==='ideas-csv'?p._boardId:p._boardId??p.board)}
 for(const record of posts.values()) {
  const p=asObject(record.payload);if(!boards.has(boardId(record)))missing(record,'board',boardId(record))
  if(p._format!=='ideas-csv'&&p.author&&!users.has(reference(p.author)))missing(record,'author',reference(p.author))
  if(boards.has(boardId(record))&&parents.has(record.sourceId)&&boards.has(boardId(posts.get(root(record.sourceId))!))&&Boolean(asObject(boards.get(boardId(record))!.payload).isPrivate)!==Boolean(asObject(boards.get(boardId(posts.get(root(record.sourceId))!))!.payload).isPrivate))throw new Error('Merge visibility mismatch')
  for(const tag of p._format!=='ideas-csv'&&Array.isArray(p.tags)?p.tags:[])if(!tags.has(reference(tag)))missing(record,'tags',reference(tag))
 }
 for(const record of records.filter(r=>['votes','comments'].includes(r.kind))) {
  const p=asObject(record.payload)
  if(!posts.has(reference(p.post)))missing(record,'post',reference(p.post))
  const author=record.kind==='votes'?'voter':'author';if(!users.has(reference(p[author])))missing(record,author,reference(p[author]))
  if(record.kind==='comments'&&p.parentID&&!comments.has(reference(p.parentID)))missing(record,'parentID',reference(p.parentID))
 }
 const rank = (r:SourceRecord) => ({boards:0,users:1,tags:2,posts:3,votes:4,comments:5,merges:6}[r.kind]??7)
 const depth = (id:string):number => parents.has(id)?1+depth(parents.get(id)!):0
 const existingUsers=new Set(records.filter(r=>r.kind==='users').map(r=>r.sourceId))
 records.push(...[...users.values()].filter(u=>!existingUsers.has(u.sourceId)))
 for(const issue of unresolved)source.diagnostics.push({severity:'error',code:'UNRESOLVED_REFERENCE',message:issue.target,kind:issue.kind,sourceId:issue.sourceId,field:issue.field})
 records.sort((a,b)=>rank(a)-rank(b)||(a.kind==='posts'?depth(a.sourceId)-depth(b.sourceId):0)||a.sourceId.localeCompare(b.sourceId))
 source.records=records
 return {users,posts,boards,tags,comments,merges,parents,root,boardId,unresolved}
}
