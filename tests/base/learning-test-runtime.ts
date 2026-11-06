import {applyD1Migrations,reset} from 'cloudflare:test'
import {env} from 'cloudflare:workers'
import {beforeEach,expect,inject,vi} from 'vitest'
import {createPennyApi} from '@/core/app/api'
import {digest} from '@/core/features/auth/native-tokens'
import {canonical} from '@/core/features/data/archive'
import type {AppBindings} from '@/core/shared/bindings'
import type {LearningOutput} from '@/core/features/learning/schema'
import {base64urlEncode,sign} from '@/core/features/auth/tokens'
import {learningOutput,type ModelInput} from './learning-fixture'
const app=createPennyApi(),origin='https://penny.test'
export const path='/api/operator/learning'
export let sent:string[]=[]
export const network={sourceStatus:200,badCitation:false,beforeModel:undefined as (()=>Promise<void>)|undefined,lastBody:'',sourceText:null as string|null,modelOutput:undefined as ((output:LearningOutput,input:ModelInput)=>unknown)|undefined}
export const config={orbit:{origin:'https://orbit.example.com',token:'network-edge-test-token',installationId:'fixture-orbit',audiencePrincipalIds:['source-operator'],readCostMicros:0}}
export const bindings=():AppBindings=>({...env,PENNY_LEARNING:JSON.stringify(config),PENNY_AI:JSON.stringify({anthropic:{apiKey:'synthetic-edge-model-key',models:[{id:'configured-claude',inputMicrosPerToken:1,outputMicrosPerToken:2,maxOutputTokens:4000}]},openai:{apiKey:'synthetic-edge-openai-key',models:[{id:'configured-model',inputMicrosPerToken:1,outputMicrosPerToken:2,maxOutputTokens:4000}]}}),PENNY_LEARNING_EGRESS:{async send(wire){sent.push(wire.method+' '+wire.url);if(wire.method==='GET'){
 if(network.sourceStatus!==200)return {status:network.sourceStatus,headers:{},body:'{}'}
 const target=new URL(wire.url).searchParams.get('target')!,text=network.sourceText??canonical({id:target.split('/')[1],subject:'I cancelled because I could not hand off the report.',occurred_at:'2026-10-01T00:00:00Z',confidence:'observed'})
 return {status:200,headers:{},body:JSON.stringify({provider:'orbit',installationId:'fixture-orbit',accountId:'workspace',principalId:'source-operator',target,revision:await digest(text),observedAt:'2026-10-14T00:00:00Z',audience:{kind:'source-principals',principalIds:['source-operator']},title:'Cancellation',text,canonicalUrl:'https://orbit.example.com'+(target.startsWith('opportunities/')?'/app/opportunities/'+target.split('/')[1]:'/app/records')})}
 }
 expect(['https://api.openai.com/v1/chat/completions','https://api.anthropic.com/v1/messages']).toContain(wire.url);const reservation=await env.DB.prepare("SELECT reserved_micros FROM penny_ai_runs WHERE state='reserved' ORDER BY created_at DESC LIMIT 1").first<{reserved_micros:number}>();expect(reservation).not.toBeNull();expect(reservation!.reserved_micros).toBeGreaterThanOrEqual(100*1+500*2);network.lastBody=wire.body;const payload=JSON.parse(wire.body);if(wire.url.includes('anthropic')&&unsupportedSchema(payload.output_config.format.schema))return {status:400,headers:{},body:JSON.stringify({error:{type:'invalid_request_error'}})};const input=JSON.parse(payload.messages.at(-1).content) as ModelInput,output=learningOutput(input);if(network.badCitation)output.citations[0].quote='invented quote';if(network.beforeModel)await network.beforeModel();const modelOutput=network.modelOutput?.(output,input)??output;return {status:200,headers:{},body:JSON.stringify(wire.url.includes('anthropic')?{content:[{type:'text',text:JSON.stringify(modelOutput)}],stop_reason:'end_turn',usage:{input_tokens:100,output_tokens:500}}:{choices:[{message:{content:JSON.stringify(modelOutput)},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:500}})} }}})
let ip=0
export const call=(url:string,body?:unknown,cookie='',custom?:AppBindings,method=body===undefined?'GET':'POST',headers:Record<string,string>={})=>app.fetch(new Request(origin+url,{method,headers:{Host:'penny.test',Origin:origin,Cookie:cookie,'Content-Type':'application/json','CF-Connecting-IP':`192.0.2.${++ip}`,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),custom??bindings())
export async function json<T=Record<string,unknown>>(response:Response|Promise<Response>,status=200):Promise<T>{const r=await response;expect(r.status,await r.clone().text()).toBe(status);return r.json() as Promise<T>}
export async function resetLearning(){await reset();await applyD1Migrations(env.DB,inject('migrations'));sent=[];network.sourceStatus=200;network.badCitation=false;network.beforeModel=undefined;network.sourceText=null;network.modelOutput=undefined}
beforeEach(resetLearning)
export async function fixture({nativeOnly=false}={}){const boot=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner'});expect(boot.status).toBe(303);const cookie=boot.headers.get('set-cookie')!.split(';')[0];await json(call('/api/operator/settings/ai',{monthlyBudgetMicros:100000000,includePrivate:true,choices:[]},cookie,undefined,'PUT'));const evidence=await json<{id:string}>(call('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Native cancellation note',wording:'Customer cancelled after the report handoff failed.',observedAt:'2026-10-01T00:00:00Z'},cookie),201);const source=nativeOnly?null:await json<{id:string}>(call(path+'/sources',{name:'Selected sales context',provider:'orbit',resourceIds:['signals/cancellation'],useBasis:'Authorized cancellation investigation for every operator',allOperatorsAuthorized:true},cookie),201);const investigation=await json<{id:string}>(call(path+'/investigations',{sourceId:source?.id,question:'',nativeEvidenceIds:[evidence.id],nativeRequestIds:[],purpose:'Understand the cancellation and prepare a bounded next step',expiresAt:'2099-01-01T00:00:00Z',budgetMicros:1000000,maxRunCostMicros:100000,intervalMinutes:60},cookie),201);return {cookie,evidence,source:source??{id:(await env.DB.prepare('SELECT source_id FROM learning_investigations WHERE id=?').bind(investigation.id).first<string>('source_id'))!},investigation}}

// Provider-side validation at the paid edge, matching the documented raw-schema API.
function unsupportedSchema(value:unknown):boolean{
 if(Array.isArray(value))return value.some(unsupportedSchema)
 if(!value||typeof value!=='object')return false
 return Object.entries(value).some(([key,item])=>['minimum','maximum','exclusiveMinimum','exclusiveMaximum','multipleOf','minLength','maxLength','maxItems'].includes(key)||(key==='minItems'&&Number(item)>1)||(['properties','$defs','definitions'].includes(key)&&item&&typeof item==='object'?Object.values(item).some(unsupportedSchema):unsupportedSchema(item)))
}

export interface DimensionOriginal {id:string;wording:string;observedAt:string;requesterId:string|null;accountId:string|null}
/** Create originals through native doors; only the configured model HTTP edge is replaced. */
export async function dimensionOriginals(cookie:string){
 const actor=await env.DB.prepare('SELECT id FROM operators LIMIT 1').first<string>('id'),clock=Date.now()
 const accounts=[] as string[]
 for(const name of ['synthetic-penny-1','synthetic-penny-2'])accounts.push((await json<{id:string}>(call('/api/operator/accounts',{name,internalOwnerId:actor},cookie),201)).id)
 // Offset timestamps make the lexically later supporting observation older.
 const originals:DimensionOriginal[]=[]
 for(const [index,accountId] of [accounts[0],accounts[0],accounts[1],null].entries()){
  const input={sourceType:'free_text',sourceLabel:'Native comparison original',wording:`synthetic-penny-${index+1} handoff observation`,observedAt:[new Date(clock-86400000).toISOString(),new Date(clock+11*3600000).toISOString().replace('Z','+10:00'),new Date(clock+90*60000).toISOString(),new Date(clock-300000).toISOString()][index],accountId}
  const evidence=await json<{id:string}>(call('/api/operator/evidence',input,cookie),201)
  originals.push({id:evidence.id,wording:input.wording,observedAt:input.observedAt,requesterId:null,accountId})
 }
 await json(call('/api/operator/boards',{name:'Native comparison',slug:'native-comparison',visibility:'public'},cookie),201)
 const secret='synthetic-penny-host-signing-material',custom={...bindings(),PORTAL_IDENTITY_SECRET:secret}
 vi.useFakeTimers({toFake:['Date']})
 try{
  for(const [index,person] of [1,1,2].entries()){
   const observedAt=new Date(clock+(index+1)*1000).toISOString();vi.setSystemTime(observedAt)
   const claim={aud:origin,issuedAt:observedAt,email:[`synthetic-penny-${person}`,'example.test'].join('@'),displayName:`Synthetic Penny ${person}`},encoded=base64urlEncode(new TextEncoder().encode(JSON.stringify(claim)))
   const headers={'X-Penny-Identity':encoded,'X-Penny-Identity-Signature':base64urlEncode(await sign(secret,encoded))}
   const title=`synthetic-penny-${index+5} handoff observation`,description='The existing handoff needs clarification.'
   const submitted=await json<{slug:string}>(call('/api/public/requests',{title,description,boardSlug:'native-comparison',idempotencyKey:crypto.randomUUID()},'',custom,'POST',headers),201)
   const original=await env.DB.prepare('SELECT e.id,e.requester_id AS requesterId FROM requests r JOIN request_evidence_links l ON l.request_id=r.id JOIN evidence_items e ON e.id=l.evidence_id WHERE r.slug=?').bind(submitted.slug).first<{id:string;requesterId:string}>()
   expect(original).not.toBeNull()
   originals.push({...original!,wording:title+'\n\n'+description,observedAt,accountId:null})
  }
 }finally{vi.useRealTimers()}
 expect(originals[4].requesterId).toBe(originals[5].requesterId);expect(originals[4].requesterId).not.toBe(originals[6].requesterId)
 return originals
}
