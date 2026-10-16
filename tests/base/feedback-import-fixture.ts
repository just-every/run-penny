import boards from '../fixtures/imports/boards.json'
import users from '../fixtures/imports/users.json'
import posts from '../fixtures/imports/posts.json'
import votes from '../fixtures/imports/votes.json'
import comments from '../fixtures/imports/comments.json'
import tags from '../fixtures/imports/tags.json'
import exportVotes from '../fixtures/imports/export/votes.json'
import exportComments from '../fixtures/imports/export/comments.json'
import exportMerges from '../fixtures/imports/export/merges.json'
import publicCsv from '../fixtures/imports/export/public.csv?raw'
import internalCsv from '../fixtures/imports/export/internal.csv?raw'
import { Buffer } from 'node:buffer'
import { expect } from 'vitest'
import type { SavedFeedbackInput } from '@/core/features/imports/types'
import { call,env,origin } from './support'
import { runtime } from './notification-regression-fixture'
export const importPath='/api/operator/feedback-import'
export function feedbackFixture(namespace='saved-feedback'):SavedFeedbackInput {
 return {namespace,statuses:{open:'open',planned:'planned'},files:Object.entries({boards,users,posts,votes,comments,tags}).map(([kind,data])=>({name:kind+'.json',kind:kind as SavedFeedbackInput['files'][number]['kind'],version:['users','votes','comments'].includes(kind)?'v2':'v1',base64:Buffer.from(JSON.stringify(data)).toString('base64')}))}
}
export function exportFeedbackFixture(namespace='export-feedback'):SavedFeedbackInput {
 const source=feedbackFixture(namespace)
 source.files=source.files.filter(file=>['boards','tags'].includes(file.kind))
 for(const [name,boardId,text] of [['public.csv','public-board',publicCsv],['internal.csv','internal-board',internalCsv]])source.files.push({name,boardId,kind:'posts',version:'classic-csv',tagMapping:{Accessibility:['tag-0'],'Private renewal concern':['tag-1']},base64:Buffer.from(text).toString('base64')})
 for(const [kind,data] of Object.entries({votes:exportVotes,comments:exportComments,merges:exportMerges}))source.files.push({name:kind+'.json',kind:kind as 'votes'|'comments'|'merges',version:kind==='merges'?'relationships-v1':'v2',base64:Buffer.from(JSON.stringify(data)).toString('base64')})
 return source
}
export async function preview(source:SavedFeedbackInput,operator:Record<string,string>) {
 const response=await call(importPath+'/preview',source,operator);expect(response.status,await response.clone().text()).toBe(200)
 return await response.json() as {fingerprint:string;counts:{rejected:number;mapped:number;byKind:Record<string,number>};rows:{kind:string;applied:number;rejection:string|null;omissions:{field?:string;reason:string}[]}[]}
}
export async function erasurePreview(table:'requesters'|'requests',id:string,operator:Record<string,string>){
 let response=await call('/api/operator/data/erasure/preview',{table,id},operator)
 while(response.status===202){
  const {continuation}=await response.json() as {continuation:string}
  expect(continuation).toEqual(expect.any(String))
  response=await call('/api/operator/data/erasure/preview',{table,id,continuation},operator)
 }
 expect(response.status,await response.clone().text()).toBe(200)
 return response
}
export async function complete(job:{id:string;state:string;checkpoint:number},operator:Record<string,string>) {
 for(let i=0;i<20&&!['completed','undone','rolled_back'].includes(job.state);i++){
  const response=await call(importPath+'/jobs/'+job.id+'/resume',{},operator);expect(response.status,await response.clone().text()).toBe(200)
  const next=await response.json() as typeof job;expect(next.checkpoint>=job.checkpoint).toBe(true);job=next
 }
 expect(['completed','undone','rolled_back']).toContain(job.state);return job
}
export async function apply(source:SavedFeedbackInput,operator:Record<string,string>) {
 const plan=await preview(source,operator);expect(plan.counts.rejected).toBe(0)
 const response=await call(importPath+'/apply',{source,fingerprint:plan.fingerprint},operator);expect([200,202],await response.clone().text()).toContain(response.status)
 return complete(await response.json() as {id:string;state:string;checkpoint:number},operator)
}
export async function counts(){const tables=['boards','requesters','requests','request_vote_contributions','request_votes','request_comments','request_merges','tags','evidence_items','feedback_import_records'];return Object.fromEntries(await Promise.all(tables.map(async table=>[table,(await env.DB.prepare('SELECT COUNT(*) n FROM '+table).first<{n:number}>())!.n])))}

// Historical upgrade fixtures populate the real previous D1 importer context.
// Its bare D1 storage predates the effect-suppression schema added in 0022.
// Current product routes retain that fence; no production fallback is added.
export async function applyPreviousFeedback(input:SavedFeedbackInput,operator:Record<string,string>) {
 const {populateLegacyFeedback}=await import('./legacy-feedback-fixture')
 return populateLegacyFeedback(input,operator)
}
export async function populateFeedback(input:SavedFeedbackInput,operator:Record<string,string>,partial=false) {
 const {importContext,requestPrincipal}=await import('@/core/features/imports/service')
 const {context,actor}=await importContext(runtime(),await requestPrincipal(runtime(),new Request(origin+importPath+'/apply',{method:'POST',headers:{Origin:origin,...operator}})),input.namespace)
 context.storage.database=env.DB
 const {readSavedFeedback}=await import('@/core/features/imports/source'),{feedbackMapping}=await import('@/core/features/imports/mapping')
 const {planD1Import,createD1ImportJob,applyD1ImportBatches,resumeD1Import}=await import('../../base/modules/import-kit/src/d1/index.ts')
 const saved=await readSavedFeedback(input),plan=await planD1Import(saved,feedbackMapping(saved,actor),context)
 expect(plan.counts.rejected).toBe(0);context.reviewedFingerprint=plan.fingerprint;context.operationKey=plan.fingerprint
 const imported=await createD1ImportJob(plan,context);let job=await applyD1ImportBatches(imported.id,context)
 for(let batch=0;!partial&&batch<20&&job.state!=='completed';batch++)job=await resumeD1Import(job.id,context)
 if(!partial)expect(job.state).toBe('completed');return job
}
export function ideasFeedbackFixture(namespace='ideas-feedback'):SavedFeedbackInput {
 const text='\uFEFFIdea key,Title,Description,Status,Created,Votes,Comments,Companies\r\nidea-1,"Keyboard, labels","Exact café \"\"quote\"\"\r\nSecond line",open,2024-07-08T09:10:11.000Z,40,12,"Acme, Inc."\r\n'
 return {namespace,statuses:{open:'open'},boards:[{id:'ideas-board',name:'Ideas history',isPrivate:true,created:'2024-07-08T09:10:11.000Z'}],files:[{name:'ideas.csv',kind:'posts',version:'ideas-csv',boardId:'ideas-board',ideas:{key:'Idea key',title:'Title',details:'Description',status:'Status',created:'Created',aggregates:{Votes:'count',Comments:'count',Companies:'company'}},base64:Buffer.from(text).toString('base64')}]}
}
export function boundedFeedbackFixture(namespace='bounded-history'):SavedFeedbackInput {
 const created='2024-07-08T09:10:11.000Z',source=ideasFeedbackFixture(namespace)
 const users=Array.from({length:200},(_,i)=>({id:'person-'+i,name:'Historical person '+i,created}))
 const csv=['Idea key,Title,Description,Status,Created,Votes,Comments,Companies',...Array.from({length:100},(_,i)=>`idea-${i},Historical idea ${i},Supplied historical wording ${i},open,${created},40,12,Example company`)].join('\r\n')
 source.files[0].base64=Buffer.from(csv).toString('base64')
 const votes=Array.from({length:1400},(_,i)=>({id:'vote-'+i,post:'idea-'+i%100,voter:'person-'+Math.floor(i/100),created}))
 const comments=Array.from({length:300},(_,i)=>({id:'comment-'+i,post:'idea-'+i%100,author:'person-'+i%200,value:'Historical comment '+i,created,internal:false,private:false}))
 for(const [kind,value]of Object.entries({users,votes,comments}))source.files.push({name:kind+'.json',kind:kind as 'users'|'votes'|'comments',version:'v2',base64:Buffer.from(JSON.stringify({[kind==='users'?'users':'items']:value})).toString('base64')})
 return source
}
