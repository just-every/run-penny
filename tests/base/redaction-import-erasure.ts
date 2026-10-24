import {Buffer} from 'node:buffer'
import {expect} from 'vitest'
import {stableFeedbackId} from '@/core/features/imports/mapping-support'
type Call=(path:string,body?:unknown,headers?:Record<string,string>,method?:string)=>Response|Promise<Response>
/** Privacy-withheld bytes must remain erasable, with source replay fenced. */
export async function proveRedactedImportErasure(call:Call,operator:Record<string,string>,wording:string){
 const read=async<T>(response:Response|Promise<Response>,statuses=[200]):Promise<T>=>{const r=await response;expect(statuses,await r.clone().text()).toContain(r.status);return r.json() as Promise<T>}
 const root='/api/operator/feedback-import',source={namespace:'synthetic-penny-private-erasure',statuses:{},files:[{name:'users.json',kind:'users',version:'v2',base64:Buffer.from(JSON.stringify({users:[{id:'synthetic-person',name:'Synthetic erased imported contributor',created:'2026-10-01T09:00:00Z',profile:wording}]})).toString('base64')}]}
 const preview=await read<{fingerprint:string}>(call(root+'/preview',source,operator))
 let job=await read<{id:string;state:string}>(call(root+'/apply',{source,fingerprint:preview.fingerprint},operator),[200,202])
 for(let step=0;job.state!=='completed'&&step<40;step++)job=await read(call(root+'/jobs/'+job.id+'/resume',{},operator))
 expect(job.state).toBe('completed')
 const id=stableFeedbackId(source.namespace,'users','synthetic-person')
 let plan=await read<{planHash:string;continuation?:string;blockedCopies:unknown[]}>(call('/api/operator/data/erasure/preview',{table:'requesters',id},operator),[200,202])
 for(let step=0;plan.continuation&&step<100;step++)plan=await read(call('/api/operator/data/erasure/preview/continue',{continuation:plan.continuation},operator),[200,202])
 expect(plan.blockedCopies).toEqual([])
 let operation=await read<{operationId:string;status:string}>(call('/api/operator/data/erasure',{table:'requesters',id,planHash:plan.planHash},operator),[200,202])
 for(let step=0;operation.status!=='complete'&&step<100;step++)operation=await read(call('/api/operator/data/operations/'+operation.operationId+'/resume',{},operator),[200,202])
 expect(operation.status).toBe('complete')
 const replay=await read<{fingerprint:string}>(call(root+'/preview',source,operator))
 expect((await call(root+'/apply',{source,fingerprint:replay.fingerprint},operator)).status).toBe(422)
 const exported=await read(call('/api/operator/data/export',undefined,operator))
 expect(JSON.stringify(exported)).not.toContain('Synthetic erased imported contributor')
 expect(JSON.stringify(exported)).not.toContain(source.files[0].base64)
}
