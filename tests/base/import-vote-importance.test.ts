import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,expect,inject,it} from 'vitest'
import {Buffer} from 'node:buffer'
import {call,env,owner} from './support'
import {apply,complete,erasurePreview,importPath,preview} from './feedback-import-fixture'
import {stableFeedbackId} from '@/core/features/imports/mapping-support'
import type {SavedFeedbackInput} from '@/core/features/imports/types'
import type {FeedbackReceipt} from '@/core/features/imports/receipt'

beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
const created='2024-07-08T09:10:11Z'
function source(priorities:unknown[]=['Nice to have','Important','Must have','No priority']):SavedFeedbackInput {
 const users=priorities.map((_,i)=>({id:'person-'+i,name:'Historical voter '+i,created}))
 return {namespace:'vote-importance',statuses:{open:'open'},boards:[{id:'board',name:'Feedback history',isPrivate:false,created}],files:[
  {name:'posts.json',kind:'posts',version:'v1',base64:Buffer.from(JSON.stringify({posts:[{id:'post',title:'Export improvements',details:'Historical customer feedback',status:'open',board:'board',author:users[0],created}]})).toString('base64')},
  {name:'votes.json',kind:'votes',version:'v2',base64:Buffer.from(JSON.stringify({items:priorities.map((votePriority,i)=>({id:'vote-'+i,post:'post',voter:users[i],created,...(votePriority===undefined?{}:{votePriority})}))})).toString('base64')},
 ]}
}
async function receipt(id:string,operator:Record<string,string>):Promise<FeedbackReceipt>{
 const response=await call(`${importPath}/jobs/${id}/receipt`,undefined,operator);expect(response.status).toBe(200);return response.json()
}
const importanceRows=async()=>(await env.DB.prepare('SELECT requester_id,importance FROM penny_vote_importance ORDER BY importance').all()).results

it('[REQ-035 IMP-002 IMP-004] imports every documented Canny vote priority, counts each in receipts and reverses it with the vote',async()=>{
 const operator=await owner(),input=source(),plan=await preview(input,operator)
 expect(plan.counts.rejected).toBe(0)
 expect(plan.rows.filter(row=>row.kind==='votes').every(row=>!row.omissions.some(item=>item.field==='votePriority'))).toBe(true)
 const job=await apply(input,operator),rows=await importanceRows(),received=await receipt(job.id,operator)
 expect(rows.map(row=>row.importance)).toEqual([null,1,2,3])
 expect(received.voteImportance).toEqual(['Nice to have','Important','Must have','No priority'].map((sourceValue,i)=>({sourceValue,importance:i===3?null:i+1,planned:1,created:1,removed:0,retained:1})))
 expect((await apply(input,operator)).id).toBe(job.id);expect(await importanceRows()).toEqual(rows)
 const originals=await(await call(`${importPath}/jobs/${job.id}/originals`,undefined,operator)).json() as {name:string;original:{base64:string}}[]
 expect(originals.find(row=>row.name==='votes.json')?.original.base64).toBe(input.files[1].base64)
 for(const table of ['requester_addresses','requester_update_permissions','notification_outbox'])expect(await env.DB.prepare(`SELECT COUNT(*) n FROM ${table}`).first('n')).toBe(0)
 await complete(await(await call(`${importPath}/jobs/${job.id}/undo`,{},operator)).json() as {id:string;state:string;checkpoint:number},operator)
 expect(await importanceRows()).toEqual([])
 expect((await receipt(job.id,operator)).voteImportance?.every(row=>row.created===1&&row.removed===1&&row.retained===0)).toBe(true)
})

it('[REQ-035 IMP-002] refuses unknown, null and create-API numeric priorities by name, without applying any history',async()=>{
 const operator=await owner(),input=source(['Urgent',20,null,'must-have',undefined]),plan=await preview(input,operator)
 expect(plan.counts.rejected).toBe(4)
 expect(plan.rows.filter(row=>row.kind==='votes'&&row.rejection).every(row=>row.rejection!.includes('votePriority'))).toBe(true)
 const response=await call(importPath+'/preview',input,operator),body=await response.json() as {receipt:FeedbackReceipt}
 expect(body.receipt.omissions.find(item=>item.field==='votePriority')).toMatchObject({count:4})
 expect((await call(importPath+'/apply',{source:input,fingerprint:plan.fingerprint},operator)).status).toBe(422)
 expect(await importanceRows()).toEqual([])
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM requests').first('n')).toBe(0)
 // A source without votePriority continues to import an ordinary vote.
 await apply(source([undefined]),operator)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM request_votes').first('n')).toBe(1)
 expect(await importanceRows()).toEqual([])
})

it('[REQ-035 DATA-003] erasing an imported voter removes importance and prevents re-import of that identity',async()=>{
 const operator=await owner(),input=source(),job=await apply(input,operator),id=stableFeedbackId(input.namespace,'users','person-1')
 const plan=await(await erasurePreview('requesters',id,operator)).json() as {planHash:string;blockedCopies:unknown[]}
 expect(plan.blockedCopies).toEqual([])
 const response=await call('/api/operator/data/erasure',{table:'requesters',id,planHash:plan.planHash},operator)
 expect([200,202],await response.clone().text()).toContain(response.status)
 let result=await response.json() as {operationId:string;status:string}
 for(let step=0;step<100&&result.status!=='complete';step++){const next=await call(`/api/operator/data/operations/${result.operationId}/resume`,{},operator);expect([200,202],await next.clone().text()).toContain(next.status);result=await next.json() as typeof result}
 expect(result.status).toBe('complete')
 expect((await importanceRows()).map(row=>row.requester_id)).not.toContain(id)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM penny_vote_importance').first('n')).toBe(3)
 expect((await call(`${importPath}/jobs/${job.id}/receipt`,undefined,operator)).status).toBe(200)
 const reviewed=await preview(input,operator)
 expect((await call(importPath+'/apply',{source:input,fingerprint:reviewed.fingerprint},operator)).status).toBe(422)
})
