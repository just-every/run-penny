import {applyD1Migrations,reset} from 'cloudflare:test'
import {env} from 'cloudflare:workers'
import {beforeEach,expect,inject} from 'vitest'
import {createPennyApi} from '@/core/app/api'
import {digest} from '@/core/features/auth/native-tokens'
import {canonical} from '@/core/features/data/archive'
import type {AppBindings} from '@/core/shared/bindings'
import {learningOutput,type ModelInput} from './learning-fixture'
const app=createPennyApi(),origin='https://penny.test'
export const path='/api/operator/learning'
export let sent:string[]=[]
export const network={sourceStatus:200,badCitation:false,beforeModel:undefined as (()=>Promise<void>)|undefined,sourceText:null as string|null}
export const config={orbit:{origin:'https://orbit.example.com',token:'network-edge-test-token',installationId:'fixture-orbit',audiencePrincipalIds:['source-operator'],readCostMicros:0},model:{apiKey:'network-edge-model-key',model:'configured-model',inputMicrosPerToken:1,outputMicrosPerToken:2,maxOutputTokens:4000}}
export const bindings=():AppBindings=>({...env,PENNY_LEARNING:JSON.stringify(config),PENNY_LEARNING_EGRESS:{async send(wire){sent.push(wire.method+' '+wire.url);if(wire.method==='GET'){
 if(network.sourceStatus!==200)return {status:network.sourceStatus,headers:{},body:'{}'}
 const target=new URL(wire.url).searchParams.get('target')!,text=network.sourceText??canonical({id:target.split('/')[1],subject:'I cancelled because I could not hand off the report.',occurred_at:'2026-10-01T00:00:00Z',confidence:'observed'})
 return {status:200,headers:{},body:JSON.stringify({provider:'orbit',installationId:'fixture-orbit',accountId:'workspace',principalId:'source-operator',target,revision:await digest(text),observedAt:'2026-10-14T00:00:00Z',audience:{kind:'source-principals',principalIds:['source-operator']},title:'Cancellation',text,canonicalUrl:'https://orbit.example.com'+(target.startsWith('opportunities/')?'/app/opportunities/'+target.split('/')[1]:'/app/records')})}
 }
 expect(wire.url).toBe('https://api.openai.com/v1/chat/completions');const payload=JSON.parse(wire.body),input=JSON.parse(payload.messages[1].content) as ModelInput,output=learningOutput(input);if(network.badCitation)output.citations[0].quote='invented quote';if(network.beforeModel)await network.beforeModel();return {status:200,headers:{},body:JSON.stringify({choices:[{message:{content:JSON.stringify(output)},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:500}})} }}})
let ip=0
export const call=(url:string,body?:unknown,cookie='',custom?:AppBindings)=>app.fetch(new Request(origin+url,{method:body===undefined?'GET':'POST',headers:{Host:'penny.test',Origin:origin,Cookie:cookie,'Content-Type':'application/json','CF-Connecting-IP':`192.0.2.${++ip}`},...(body===undefined?{}:{body:JSON.stringify(body)})}),custom??bindings())
export async function json<T=Record<string,unknown>>(response:Response|Promise<Response>,status=200):Promise<T>{const r=await response;expect(r.status,await r.clone().text()).toBe(status);return r.json() as Promise<T>}
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));sent=[];network.sourceStatus=200;network.badCitation=false;network.beforeModel=undefined;network.sourceText=null})
export async function fixture(){const boot=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner'});expect(boot.status).toBe(303);const cookie=boot.headers.get('set-cookie')!.split(';')[0];const evidence=await json<{id:string}>(call('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Native cancellation note',wording:'Customer cancelled after the report handoff failed.',observedAt:'2026-10-01T00:00:00Z'},cookie),201);const source=await json<{id:string}>(call(path+'/sources',{name:'Selected sales context',provider:'orbit',resourceIds:['signals/cancellation'],useBasis:'Authorized cancellation investigation for every operator',allOperatorsAuthorized:true},cookie),201);const investigation=await json<{id:string}>(call(path+'/investigations',{sourceId:source.id,question:'',nativeEvidenceIds:[evidence.id],nativeRequestIds:[],purpose:'Understand the cancellation and prepare a bounded next step',expiresAt:'2099-01-01T00:00:00Z',budgetMicros:1000000,maxRunCostMicros:100000,intervalMinutes:60},cookie),201);return {cookie,evidence,source,investigation}}
