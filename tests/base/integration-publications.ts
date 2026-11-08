import {expect} from 'vitest'
import type {Row} from '@/core/features/data/archive'
import type {releaseGraph} from './release-fixture'
import {orderedRows} from './integration-delivery-fixture'

type Identities={subject:{id:string;slug:string};comment:{id:string};statusKey:string;release:Awaited<ReturnType<typeof releaseGraph>>;update:{transitionId:string};shipped:{transitionId:string}}
type Publications=Record<string,Row[]>

/** Independent content oracles accompany the complete before and after records. */
export function expectPublicationContent(records:Publications,{subject,comment,statusKey,release,update,shipped}:Identities){
 const fields=(table:string,...keys:string[])=>orderedRows(records[table].map(row=>Object.fromEntries(keys.map(key=>[key,row[key]]))))
 expect(fields('requests','id','slug','public_title','public_description')).toEqual(orderedRows([
  {id:subject.id,slug:subject.slug,public_title:'synthetic-penny-approved-request',public_description:'synthetic-penny-approved-description'},
  {id:release.requests[0].id,slug:release.requests[0].slug,public_title:'Public request 0',public_description:'Public description'},
 ]))
 expect(fields('request_comments','id','request_id','body','moderation_state','operator_id')).toEqual([
  {id:comment.id,request_id:subject.id,body:'synthetic-penny-approved-reply',moderation_state:'approved',operator_id:release.actor},
 ])
 expect(fields('request_status_updates','id','request_id','public_status','body','pinned','operator_id','action_key','publication_version')).toEqual([
  {id:expect.any(String),request_id:subject.id,public_status:'under_review',body:'synthetic-penny-approved-status',pinned:0,operator_id:release.actor,action_key:statusKey,publication_version:1},
 ])
 expect(fields('roadmap_publications','id','roadmap_item_id','public_title','public_summary','public_slug','withdrawn_at')).toEqual([
  {id:'release-approval',roadmap_item_id:'release-item',public_title:'Approved improvement',public_summary:'Approved problem',public_slug:'safe-roadmap-token',withdrawn_at:null},
 ])
 expect(fields('roadmap_update_versions','id','transition_id','roadmap_item_id','version_number','public_status','title','problem','body','public_slug','approval_id')).toEqual(orderedRows([
  {id:update.transitionId,transition_id:update.transitionId,roadmap_item_id:'release-item',version_number:1,public_status:'in_progress',title:'Approved improvement',problem:'Approved problem',body:'Approved improvement: In progress\n\nApproved problem',public_slug:'safe-roadmap-token',approval_id:'release-approval'},
  {id:shipped.transitionId,transition_id:shipped.transitionId,roadmap_item_id:'release-item',version_number:2,public_status:'shipped',title:'Approved improvement',problem:'Approved problem',body:'Approved improvement: Shipped\n\nApproved problem',public_slug:'safe-roadmap-token',approval_id:'release-approval'},
 ]))
 expect(fields('roadmap_update_targets','version_id','request_id')).toEqual(orderedRows([update,shipped].map(({transitionId})=>({version_id:transitionId,request_id:release.requests[0].id}))))
 expect(fields('roadmap_update_histories','id','version_id','request_id')).toEqual([
  {id:expect.any(String),version_id:update.transitionId,request_id:release.requests[0].id},
 ])
 expect(fields('roadmap_update_contexts','version_id','requester_id','address_id','request_id','title','slug')).toEqual([
  {version_id:update.transitionId,requester_id:release.recipient.requesterId,address_id:release.recipient.addressId,request_id:release.requests[0].id,title:'Public request 0',slug:release.requests[0].slug},
 ])
 expect(fields('releases','id','slug','state','current_version_id','author_operator_id')).toEqual([
  {id:release.draft.id,slug:release.draft.slug,state:'published',current_version_id:release.draft.versionId,author_operator_id:release.actor},
 ])
 expect(fields('release_versions','id','release_id','version_number','title','release_type','body','publication_date','setup_url','outcome_prompt','subject_tags_json','is_portal_current','author_name','tag_names_json','public_labels_json','public_products_json')).toEqual([
  {id:release.draft.versionId,release_id:release.draft.id,version_number:1,title:release.input.title,release_type:release.input.releaseType,body:release.input.body,publication_date:release.input.publicationDate,setup_url:release.input.setupUrl,outcome_prompt:'Have you adopted this update?',subject_tags_json:JSON.stringify(release.input.tagIds),is_portal_current:1,author_name:'Owner',tag_names_json:'["Workflow"]',public_labels_json:'[]',public_products_json:'[]'},
 ])
 expect(fields('release_targets','release_id','roadmap_item_id','decision_id','approval_id','public_title','public_summary','public_slug')).toEqual([
  {release_id:release.draft.id,roadmap_item_id:'release-item',decision_id:'release-decision',approval_id:'release-approval',public_title:'Approved improvement',public_summary:'Approved problem',public_slug:'safe-roadmap-token'},
 ])
 expect(fields('release_target_snapshots','version_id','roadmap_item_id','decision_id','request_id')).toEqual([
  {version_id:release.draft.versionId,roadmap_item_id:'release-item',decision_id:'release-decision',request_id:release.requests[0].id},
 ])
 expect(fields('release_recipient_snapshots','id','release_version_id','requester_id','requester_address_id','request_id','evidence_id','recipient_email')).toEqual([
  {id:expect.any(String),release_version_id:release.draft.versionId,requester_id:release.recipient.requesterId,requester_address_id:release.recipient.addressId,request_id:release.requests[0].id,evidence_id:null,recipient_email:release.recipient.email},
 ])
 expect(fields('release_recipient_contexts','snapshot_id','request_id','roadmap_item_id','title','slug')).toEqual([
  {snapshot_id:records.release_recipient_snapshots[0].id,request_id:release.requests[0].id,roadmap_item_id:'release-item',title:'Public request 0',slug:release.requests[0].slug},
 ])
}

export function expectPublicPublicationContent(visible:{details:Record<string,unknown>[];roadmap:unknown[];roadmapDetail:unknown;releases:unknown[];releaseDetail:unknown},records:Publications,{subject,comment,release}:Identities){
 const status=records.request_status_updates[0],history=records.roadmap_update_histories[0],update=records.roadmap_update_versions.find(row=>row.id===history.version_id)!
 const {slug,title,description,status:state,comments,statusUpdates}=visible.details[0]
 expect({slug,title,description,state,comments,statusUpdates}).toEqual({
  slug:subject.slug,title:'synthetic-penny-approved-request',description:'synthetic-penny-approved-description',state:'under_review',
  comments:[{id:comment.id,author:{displayName:'Owner',kind:'operator'},body:'synthetic-penny-approved-reply',publishedAt:records.request_comments[0].published_at}],
  statusUpdates:[{id:status.id,status:'under_review',body:'synthetic-penny-approved-status',pinned:0,publishedAt:status.published_at}],
 })
 expect(visible.details[1].statusUpdates).toEqual([{id:history.id,status:'in_progress',body:'Approved improvement: In progress\n\nApproved problem',pinned:0,publishedAt:update.published_at}])
 const roadmap={slug:'safe-roadmap-token',title:'Approved improvement',summary:'Approved problem',status:'shipped',publicEta:null,requests:[{slug:release.requests[0].slug,title:'Public request 0'}],releases:[{slug:release.draft.slug,title:release.input.title}]}
 expect(visible.roadmap).toEqual([roadmap]);expect(visible.roadmapDetail).toEqual(roadmap)
 const published={slug:release.draft.slug,versionNumber:1,title:release.input.title,releaseType:release.input.releaseType,body:release.input.body,publicationDate:release.input.publicationDate,setupUrl:release.input.setupUrl,authorName:'Owner',labels:[],products:[],isCurrent:true}
 expect(visible.releases).toEqual([published]);expect(visible.releaseDetail).toEqual(published)
}
