import {expect} from 'vitest'
import {env} from 'cloudflare:workers'
import {createPennyApi} from '@/core/app/api'
import type {AppBindings} from '@/core/shared/bindings'
import {canonical,type Archive,type ErasureJournal} from '@/core/features/data/archive'
import {digest} from '@/core/features/auth/native-tokens'
import {learningOutput,type ModelInput} from './learning-fixture'

type Call=(path:string,body?:unknown,headers?:Record<string,string>,method?:string)=>Response|Promise<Response>
type Detail={observations:{id:string;wording:string;original:{envelope?:{text:string;revision:string};retainedRevision?:string};presentation:{excerpts:{quote:string}[]}}[];artifacts:{id:string;state:string;body:ReturnType<typeof learningOutput>}[]}
/** No hooks: this network-edge fixture can participate in the capture-door
 * matrix without installing another suite's reset or authentication runtime. */
export async function proveLearningRedaction(call:Call,operator:Record<string,string>,wording:string){
 const read=async<T>(response:Response|Promise<Response>,status=200):Promise<T>=>{const r=await response;expect(r.status,await r.clone().text()).toBe(status);return r.json() as Promise<T>}
 const root='/api/operator/learning',app=createPennyApi(),secretValues=['234-56-7890','4111 1111 1111 1111']
 let sourceText=canonical({id:'redaction-door',subject:wording,confidence:wording,nested:{notes:[wording]},contact_id:'door-person',occurred_at:'2026-10-01T00:00:00Z'}),modelCalls=0
 const custom:AppBindings={...env,PENNY_LEARNING:JSON.stringify({orbit:{origin:'https://orbit.example.com',token:'synthetic-redaction-edge-token',installationId:'redaction-orbit',audiencePrincipalIds:['source-operator'],readCostMicros:0}}),PENNY_AI:JSON.stringify({openai:{apiKey:'synthetic-redaction-model-key',models:[{id:'redaction-fixture',inputMicrosPerToken:1,outputMicrosPerToken:2,maxOutputTokens:4000}]}}),PENNY_LEARNING_EGRESS:{async send(wire){
  if(wire.method==='GET')return {status:200,headers:{},body:JSON.stringify({provider:'orbit',installationId:'redaction-orbit',accountId:'workspace',principalId:'source-operator',target:'signals/redaction-door',revision:await digest(sourceText),observedAt:'2026-10-24T00:00:00Z',audience:{kind:'source-principals',principalIds:['source-operator']},title:wording,text:sourceText,canonicalUrl:'https://orbit.example.com/app/records',extra:{note:wording}})}
  modelCalls++;const input=JSON.parse(JSON.parse(wire.body).messages.at(-1).content) as ModelInput
  return {status:200,headers:{},body:JSON.stringify({choices:[{message:{content:JSON.stringify(learningOutput(input))},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:500}})}
 }}}
 let requestNumber=0
 const edgeCall=(path:string,body?:unknown,method=body===undefined?'GET':'POST')=>app.fetch(new Request('https://penny.test'+path,{method,headers:{...operator,Host:'penny.test',Origin:'https://penny.test','Content-Type':'application/json','CF-Connecting-IP':`198.51.100.${++requestNumber}`},...(body===undefined?{}:{body:JSON.stringify(body)})}),custom)
 // Configure the existing interpretation fixture; redaction itself makes no
 // model request. The only model sends below are ordinary investigation runs.
 await read(edgeCall('/api/operator/settings/ai',{monthlyBudgetMicros:100000000,includePrivate:true,choices:[{capability:'learning',provider:'openai',model:'redaction-fixture'}]},'PUT'))
 const evidence=await read<{id:string}>(call('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Learning redaction native input',wording,observedAt:'2026-10-01T00:00:00Z'},operator),201)
 const versions=await read<{wording:string}[]>(call(`/api/operator/evidence/${evidence.id}/versions`,undefined,operator))
 await read(call('/api/operator/boards',{name:'Learning redaction inputs',slug:'learning-redaction',visibility:'public'},operator),201)
 const request=await read<{id:string}>(call('/api/operator/requests',{title:'Learning redaction native request',description:versions[0].wording,boardSlug:'learning-redaction'},operator),201)
 const source=await read<{id:string}>(edgeCall(root+'/sources',{name:wording,provider:'orbit',resourceIds:['signals/redaction-door'],useBasis:wording,allOperatorsAuthorized:true}),201)
 const investigation=await read<{id:string}>(edgeCall(root+'/investigations',{sourceId:source.id,question:wording,purpose:wording,nativeEvidenceIds:[evidence.id],nativeRequestIds:[request.id],expiresAt:'2099-01-01T00:00:00Z',budgetMicros:1000000,maxRunCostMicros:100000,intervalMinutes:60}),201),url=root+`/investigations/${investigation.id}`
 const first=await read<{artifactId:string}>(edgeCall(url+'/run',{})),detail=await read<Detail>(edgeCall(url))
 const orbit=detail.observations.find(o=>o.original.envelope)!,retained=orbit.original.envelope!
 expect(orbit.wording).toContain('[REDACTED:ssn]');expect(orbit.wording).toContain('[REDACTED:card]')
 expect(detail.observations.every(o=>o.presentation.excerpts.every(c=>o.wording.includes(c.quote)))).toBe(true)
 expect(retained.revision).toBe(await digest(sourceText));expect(orbit.original.retainedRevision).toBe(await digest(retained.text))
 await read(edgeCall(url+'/commit',{interpretationId:first.artifactId,optionId:'assist',rationale:wording,confidence:'low',reviewAt:'2098-01-01T00:00:00Z'}),201)
 const unchanged=await read<{unchanged:boolean}>(edgeCall(url+'/run',{}));expect(unchanged.unchanged).toBe(true);expect(modelCalls).toBe(1)
 // A changed original revision must remain visible even when the changed
 // sensitive field redacts to precisely the same retained text.
 sourceText=sourceText.replace(secretValues[0],'345-67-8901')
 const changed=await read<{unchanged:boolean;artifactId:string}>(edgeCall(url+'/run',{}));expect(changed.unchanged).toBe(false);expect(changed.artifactId).not.toBe(first.artifactId)
 const after=await read<Detail>(edgeCall(url));expect(after.artifacts.find(a=>a.id===first.artifactId)?.state).toBe('contested')
 await read(edgeCall(url+'/correct',{interpretationId:changed.artifactId,correction:wording}))
 const portable=await read<{archive:Archive;journal:ErasureJournal}>(call('/api/operator/data/export',undefined,operator))
 const stored=(await env.DB.prepare('SELECT wording,original_json FROM learning_observations WHERE investigation_id=?').bind(investigation.id).all()).results
 for(const value of [...secretValues,'345-67-8901']){expect(JSON.stringify(stored)).not.toContain(value);expect(JSON.stringify(await read(edgeCall(url)))).not.toContain(value);expect(JSON.stringify(portable)).not.toContain(value)}
 const search=await read(call('/api/operator/search?q='+encodeURIComponent(secretValues[0]),undefined,operator));expect(search).toMatchObject({items:[]})
 return {investigationId:investigation.id,sourceId:source.id}
}
