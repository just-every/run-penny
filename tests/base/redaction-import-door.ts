import {proveRedactedImportErasure} from './redaction-import-erasure'
import {Buffer} from 'node:buffer'
import {expect} from 'vitest'
import {env} from 'cloudflare:workers'
import type {SavedFeedbackInput} from '@/core/features/imports/types'
import {stableFeedbackId} from '@/core/features/imports/mapping-support'
import {sha256} from '../../base/modules/import-kit/src/d1/index'
import {created,defaultIdeas,defaultVoters,ideaHeadings,voterHeadings,uservoiceCsv,uservoiceFixture} from './uservoice-fixture'

type Call=(path:string,body?:unknown,headers?:Record<string,string>,method?:string)=>Response|Promise<Response>
export type RedactionImportDoor={kind:string;requestId:string;evidenceId:string;jobId:string;source:SavedFeedbackInput;fingerprint:string}
const path='/api/operator/feedback-import'
const board={id:'synthetic-board',name:'Synthetic imported board',isPrivate:true,created}
const file=(kind:'boards'|'users'|'posts'|'comments',data:unknown):SavedFeedbackInput['files'][number]=>({name:kind+'.json',kind,version:kind==='users'||kind==='comments'?'v2':'v1',base64:Buffer.from(JSON.stringify(data)).toString('base64')})
function sources(wording:string):{kind:string;source:SavedFeedbackInput;keys:string[];stream?:boolean}[]{
 const person={id:'synthetic-person',name:'synthetic-import-person@example.test',created}
 const json:SavedFeedbackInput={namespace:'synthetic-penny-redaction-canny',statuses:{open:'open'},files:[file('boards',{boards:[board]}),file('users',{users:[person]}),file('posts',{posts:[{id:'synthetic-post',title:'Synthetic Canny source',details:wording,status:'open',board:board.id,author:person,created,retainedOnly:wording}],sourceEnvelope:wording}),file('comments',{items:[{id:'synthetic-comment',post:'synthetic-post',author:person,value:wording,created,internal:true,private:true}]})]}
 const classic:SavedFeedbackInput={namespace:'synthetic-penny-redaction-classic',statuses:{open:'open'},boards:[board],files:[{name:'classic.csv',kind:'posts',version:'classic-csv',boardId:board.id,base64:Buffer.from(uservoiceCsv(['Post URL','Post Title','Post Detail','Post Status','Date created','Post Author','Retained only'],[['https://example.test/p/synthetic-post','Synthetic classic source',wording,'open',created,'synthetic-import-person@example.test',wording]])).toString('base64')}]}
 const ideas:SavedFeedbackInput={namespace:'synthetic-penny-redaction-ideas',statuses:{open:'open'},boards:[board],files:[{name:'ideas.csv',kind:'posts',version:'ideas-csv',boardId:board.id,ideas:{key:'Idea key',title:'Title',details:'Description',status:'Status',created:'Created',omissions:['Retained only']},base64:Buffer.from(uservoiceCsv(['Idea key','Title','Description','Status','Created','Retained only'],[['synthetic-idea','Synthetic Ideas source',wording,'open',created,wording]])).toString('base64')}]}
 const uv=(stream:boolean)=>{
  const ideas=(stream?defaultIdeas:defaultIdeas.slice(0,1)).map(row=>{const next=[...row];next[ideaHeadings.indexOf('Idea Title')]='Synthetic UserVoice source '+next[0];next[ideaHeadings.indexOf('Idea Description')]=wording+(stream?' Synthetic archive padding.'.repeat(2100):'');next[ideaHeadings.indexOf('cv_Priority')]=wording;return next})
  const voters=defaultVoters.slice(0,1).map(row=>{const next=[...row];next[voterHeadings.indexOf('Feedback Description')]=wording;next[voterHeadings.indexOf('Account Name')]=wording;return next})
  const source=uservoiceFixture('synthetic-penny-redaction-uservoice-'+(stream?'stream':'ordinary'),{ideas,voters})
  for(const input of source.files)input.uservoice!.filter=wording
  return {kind:stream?'uservoice-stream':'uservoice',source,keys:ideas.map(row=>row[0]),stream}
 }
 return [{kind:'canny-json',source:json,keys:['synthetic-post']},{kind:'classic-csv',source:classic,keys:['https://example.test/p/synthetic-post']},{kind:'ideas-csv',source:ideas,keys:['synthetic-idea']},uv(false),uv(true)]
}

/** Called inside the existing redaction flow registration: no extra test or
 * provider fake. Every capture crosses preview/apply/resume and original readback. */
export async function redactionImportDoors(call:Call,operator:Record<string,string>,wording:string):Promise<RedactionImportDoor[]>{
 const read=async<T>(response:Response|Promise<Response>,statuses=[200]):Promise<T>=>{const result=await response;expect(statuses,await result.clone().text()).toContain(result.status);return result.json() as Promise<T>}
 const doors:RedactionImportDoor[]=[]
 for(const {kind,source,keys,stream} of sources(wording)){
  const review=await read<{fingerprint:string;counts:{rejected:number};receipt:{originalsRetained:boolean}}>(call(path+'/preview',source,operator))
  expect(review.counts.rejected,kind).toBe(0);expect(review.receipt.originalsRetained,kind).toBe(false)
  let job=await read<{id:string;state:string}>(call(path+'/apply',{source,fingerprint:review.fingerprint},operator),[200,202])
  for(let step=0;job.state!=='completed'&&step<40;step++)job=await read(call(path+'/jobs/'+job.id+'/resume',{},operator))
  expect(job.state,kind).toBe('completed')
  const replay=await read<{id:string}>(call(path+'/apply',{source,fingerprint:review.fingerprint},operator),[200,202]);expect(replay.id,kind).toBe(job.id)
  const original=await read<{name:string;sha256:string;size:number;original:{status:string;base64?:string}}[]>(call(path+'/jobs/'+job.id+'/originals',undefined,operator))
  for(const input of source.files){const retained=original.find(item=>item.name===input.name)!,bytes=Buffer.from(input.base64,'base64');expect(retained,kind).toBeDefined();expect(retained.sha256).toBe(sha256(bytes));expect(retained.size).toBe(bytes.length);expect(retained.original.status).toBe('unavailable');expect(retained.original.base64).toBeUndefined()}
  expect(await read(call(path+'/jobs/'+job.id+'/receipt',undefined,operator))).toMatchObject({originalsRetained:false})
  const pages=await env.DB.prepare('SELECT COUNT(*) n FROM ik_d1_stream_pages WHERE stream_id=?').bind(job.id).first<number>('n')
  if(stream)expect(pages,kind).toBeGreaterThan(0)
  expect(await env.DB.prepare('SELECT COUNT(*) n FROM ik_originals WHERE job_id IN (SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=? UNION SELECT ?) AND bytes IS NOT NULL').bind(job.id,job.id).first('n'),kind).toBe(0)
  expect(await env.DB.prepare('SELECT COUNT(*) n FROM ik_d1_original_chunks WHERE job_id IN (SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=? UNION SELECT ?)').bind(job.id,job.id).first('n'),kind).toBe(0)
  expect(await env.DB.prepare('SELECT COUNT(*) n FROM feedback_import_original_chunks WHERE bundle_id=?').bind(job.id).first('n'),kind).toBe(0)
  const rows=(await env.DB.prepare('SELECT plan_json FROM ik_jobs WHERE id IN (SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=? UNION SELECT ?) UNION ALL SELECT body FROM ik_d1_plan_chunks WHERE job_id IN (SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=? UNION SELECT ?)').bind(job.id,job.id,job.id,job.id).all()).results
  expect(JSON.stringify(rows),kind).not.toContain(wording)
  for(const key of keys)doors.push({kind,requestId:stableFeedbackId(source.namespace,'posts',key),evidenceId:stableFeedbackId(source.namespace,'evidence',key),jobId:job.id,source,fingerprint:review.fingerprint})
 }
 await proveRedactedImportErasure(call,operator,wording)
 return doors
}
