import type { ImportMapping, Json, SourceRecord, TargetEffect } from '../../../../base/modules/import-kit/src/types.ts'
import type { FeedbackSource, FeedbackStatus, NativeImportValue } from './types'
import { feedbackGraph } from './graph'
import { asObject, nativeRow, omissionFields, reference, sourceText, sourceTime, stableFeedbackId } from './mapping-support'

export const feedbackMappingVersion='penny-saved-feedback-1'
export function feedbackMapping(source: FeedbackSource, actor: string): ImportMapping {
 const graph=feedbackGraph(source), id=(kind:string,key:string)=>stableFeedbackId(source.options.namespace,kind,key)
 // The first resolvable vote for a post and contributor, in source order, is kept. Computed once from the
 // source so map() is a pure function of its record: every planning pass (ordinary, then paged) agrees.
 const votePair=(record:SourceRecord)=>{const v=asObject(record.payload);return reference(v.post)+'\0'+reference(v.voter)}, firstVotes=new Map<string,string>()
 for(const record of source.records)if(record.kind==='votes'&&!graph.unresolved.some(issue=>issue.kind===record.kind&&issue.sourceId===record.sourceId)){try{const pair=votePair(record);if(!firstVotes.has(pair))firstVotes.set(pair,record.sourceId)}catch{/* map() rejects this record by name */}}
 const effect=(record:SourceRecord,rows:NativeImportValue['rows']):TargetEffect=>({targetKind:record.kind,targetId:id(record.kind,record.sourceId),value:{rows,provenance:{sourceId:record.sourceId,artifactHash:record.artifactHash,payloadHash:record.payloadHash}} as unknown as Json})
 function map(record:SourceRecord) {
  const p=asObject(record.payload), uv=String(p._format).startsWith('uservoice-')?asObject(p._uservoice):null, idea=p._format==='ideas-csv'?asObject(p._idea):p._format==='uservoice-ideas-csv'?uv:null
  if(graph.unresolved.some(issue=>issue.kind===record.kind&&issue.sourceId===record.sourceId))return {effects:[],rejection:'Unresolved source relationships; see the receipt for each missing reference.'}
  const created=sourceTime(idea?idea.created:p.created??p['Date created']), time={created_at:created,updated_at:created}
  // The label is file, namespace, then the key: a UserVoice Idea ID is a bare number that ends the label, so idea
  // 101's label is never inside idea 1010's, and the same file name and Idea ID in another namespace is a
  // different label, so an undone trial import under another namespace never holds this one's erasure.
  const key=record.sourceId, target=id(record.kind,key), rows:NativeImportValue['rows']=[]; let used:string[]=[]
  if(record.kind==='boards') {
   if(typeof p.isPrivate!=='boolean')throw new Error('Board visibility must be supplied')
   if(p.privateComments!==undefined&&typeof p.privateComments!=='boolean')throw new Error('Board comment visibility is invalid')
   rows.push(nativeRow('boards',{id:target,slug:'import-'+target.toLowerCase(),name:sourceText(p.name,'board name',200),visibility:p.isPrivate?'internal':'public',position:0,...time}));used=['id','name','isPrivate','privateComments','created']
  } else if(record.kind==='users') {
   rows.push(nativeRow('requesters',{id:target,display_name:sourceText(p.name,'historical contributor name',200),...time}));used=['id','name','created']
  } else if(record.kind==='tags') {
   rows.push(nativeRow('tags',{id:target,name:sourceText(p.name,'private tag',200)+' · '+target.slice(-8),...time}));used=['id','name','created']
  } else if(record.kind==='posts') {
   const csv=p._format==='classic-csv', mapped=uv?uv.mapped as FeedbackStatus|undefined:source.options.statuses[sourceText(idea?idea.status:p.status??p['Post Status'],'source status',100)]
   if(!mapped)throw new Error('Status has no reviewed mapping')
   const title=sourceText(idea?idea.title:p.title??p['Post Title'],'post title',500), body=sourceText(idea?idea.details:p.details??p['Post Detail'],'post detail')
   const evidence=id('evidence',key), author=idea?(idea.author?id('users',uv?reference(idea.author):'csv-author:'+key):null):p.author?id('users',reference(p.author)):(csv&&p['Post Author'])?id('users','csv-author:'+key):null, canonical=id('posts',graph.root(key))
   if(!author&&!idea)throw new Error('Missing historical author; no identity is inferred')
   rows.push(nativeRow('requests',{id:target,slug:'feedback-'+target.toLowerCase(),board_id:id('boards',graph.boardId(record)),author_requester_id:author,title,description:body,moderation_state:'awaiting_review',public_state:mapped,merged_into_request_id:graph.parents.has(key)?id('posts',graph.parents.get(key)!):null,merged_at:graph.parents.has(key)?sourceTime(asObject([...graph.merges.values()].find(r=>reference(asObject(r.payload).sourcePostId)===key)!.payload).created):null,...time}),
    ...(author?[nativeRow('request_content_submissions',{id:id('submission',key),request_id:target,requester_id:author,title,description:body,moderation_state:'awaiting_review',is_initial:1,...time})]:[]),
    nativeRow('evidence_items',{id:evidence,source_type:'free_text',source_label:record.location.artifact+' · '+source.options.namespace+' · '+(uv?'Idea ID '+key+' (UserVoice)':key),requester_id:author,recorded_by_operator_id:actor,observed_at:created,review_state:'unreviewed',...time}),
    nativeRow('evidence_versions',{id:id('evidence-version',key),evidence_id:evidence,version_number:1,wording:body,edited_by_operator_id:actor,...time}),
    nativeRow('request_evidence_contributions',{request_id:target,evidence_id:evidence,created_at:created}),nativeRow('request_evidence_links',{request_id:canonical,evidence_id:evidence,created_at:created,stance:'supporting'}))
   for(const tag of !idea&&Array.isArray(p.tags)?p.tags:[])rows.push(nativeRow('request_tag_assignments',{request_id:target,tag_id:id('tags',reference(tag)),created_at:created}))
   used=uv?Object.keys(p):idea?Object.keys(p).filter(field=>!(idea.omissions as string[]).includes(field)):csv?['Post URL','Post Title','Post Detail','Post Status','Date created','Post Author','Tags','tags','_boardId','_format']:['id','title','details','status','board','author','created','tags','mergeHistory']
  } else if(record.kind==='votes') {
   const post=reference(p.post), user=reference(p.voter)
   if(firstVotes.get(votePair(record))!==record.sourceId)return {effects:[],unmapped:[{reason:'Duplicate vote for the same historical contributor and post; original retained.'}]}
   rows.push(nativeRow('request_vote_contributions',{request_id:id('posts',post),requester_id:id('users',user),...time}));used=uv?Object.keys(p):['id','post','voter','created']
   if(uv)rows.push(nativeRow('request_vote_supporter_types',{request_id:id('posts',post),requester_id:id('users',user),supporter_type:sourceText(uv.supporterType,'supporter type',20),created_at:created}))
  } else if(record.kind==='comments') {
   if(typeof p.internal!=='boolean'||typeof p.private!=='boolean')throw new Error('Comment privacy must be supplied')
   const post=reference(p.post), parent=p.parentID?reference(p.parentID):null
   const board=asObject(graph.boards.get(graph.boardId(graph.posts.get(post)!))!.payload)
   if(parent&&reference(asObject(graph.comments.get(parent)!.payload).post)!==post)throw new Error('Comment parent belongs to another post')
   rows.push(nativeRow('request_comments',{id:target,request_id:id('posts',graph.root(post)),origin_request_id:id('posts',post),requester_id:id('users',reference(p.author)),body:sourceText(p.value,'comment body'),moderation_state:'awaiting_review',historical_private:p.internal||p.private||board.isPrivate||board.privateComments?1:0,historical_parent_id:parent?id('comments',parent):null,...time}));used=['id','post','author','value','created','internal','private','parentID']
  } else if(record.kind==='merges') {
   const from=reference(p.sourcePostId),to=reference(p.targetPostId)
   rows.push(nativeRow('request_merges',{id:target,source_request_id:id('posts',from),target_request_id:id('posts',to),actor_operator_id:actor,merged_at:created,...time}),nativeRow('request_merge_evidence_transfers',{merge_id:target,evidence_id:id('evidence',from),target_was_linked:0,created_at:created}))
   for(const r of source.records.filter(r=>r.kind==='votes'&&reference(asObject(r.payload).post)===from)) {
    const v=asObject(r.payload);if(rows.some(row=>row.table==='request_merge_vote_transfers'&&row.values.requester_id===id('users',reference(v.voter))))continue
    rows.push(nativeRow('request_merge_vote_transfers',{merge_id:target,requester_id:id('users',reference(v.voter)),target_had_vote:source.records.some(other=>other.kind==='votes'&&reference(asObject(other.payload).post)===to&&reference(asObject(other.payload).voter)===reference(v.voter))?1:0,source_created_at:sourceTime(v.created),source_updated_at:sourceTime(v.created),created_at:created}))
   }
   for(const r of graph.comments.values())if(reference(asObject(r.payload).post)===from)rows.push(nativeRow('request_merge_comment_transfers',{merge_id:target,comment_id:id('comments',r.sourceId),created_at:created}))
   used=['id','sourcePostId','targetPostId','created']
  } else return {effects:[],rejection:'Unsupported saved object kind'}
   return {effects:[effect(record,rows)],unmapped:[...omissionFields(record,used),...(uv?uv.omissions as {field:string;reason:string}[]:[]),...(idea&&!idea.author?[{field:'requester attribution',reason:'No historical requester was supplied. Request and evidence attribution remain empty; no identity is invented.'}]:[])]}
 }
 return {version:feedbackMappingVersion,map:record=>{try{return map(record)}catch(error){return {effects:[],rejection:error instanceof Error?error.message:'Invalid source row'}}}}
}
