import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
export const capabilities={learning:'Customer learning',summary:'Evidence summaries',reply:'Reply drafts',duplicates:'Semantic duplicates',links:'Link suggestions',merges:'Duplicate sweeps',extraction:'Request extraction',themes:'Themes',spam:'Spam flags',redaction:'Redaction',ask:'Ask Penny',translation:'Translation',explanations:'Competing explanations',disconfirmation:'Disconfirming search',promises:'Promise keeper',brief:'Weekly product brief'} as const
export type Capability=keyof typeof capabilities
export const provider=z.enum(['anthropic','openai'])
const model=z.object({id:z.string().min(1).max(160),inputMicrosPerToken:z.number().finite().nonnegative(),outputMicrosPerToken:z.number().finite().nonnegative(),maxOutputTokens:z.number().int().min(1).max(16000)}).strict()
const installation=z.record(provider,z.object({apiKey:z.string().min(1),models:z.array(model).min(1).max(100)}).strict().optional())
export type Provider=z.infer<typeof provider>
export type Model=z.infer<typeof model>
export function providers(runtime:PennyRuntime){try{return installation.parse(JSON.parse(runtime.bindings.PENNY_AI??'{}'))}catch{throw new NativeError('ai_configuration_invalid',503)}}
export async function settings(db:D1Database){return (await db.prepare('SELECT monthly_budget_micros,include_private FROM penny_ai_settings WHERE singleton=1').first<{monthly_budget_micros:number;include_private:number}>())!}
export async function selected(runtime:PennyRuntime,db:D1Database,capability:Capability){
 const all=providers(runtime),choice=await db.prepare('SELECT provider,model FROM penny_ai_capabilities WHERE capability=?').bind(capability).first<{provider:Provider;model:string}>(),p=choice?.provider??'anthropic',id=choice?.model??all.anthropic?.models[0]?.id??'',entry=all[p],m=entry?.models.find(m=>m.id===id)
 if(!entry||!m||!runtime.bindings.PENNY_LEARNING_EGRESS)throw new NativeError('ai_model_unconfigured',503,'AI is unavailable. Ask the installation owner to configure the selected model and enforcing transport.')
 return {provider:p,apiKey:entry.apiKey,...m}
}
export async function costReport(db:D1Database){
 const month=new Date().toISOString().slice(0,7)
 const usage=await db.prepare("SELECT COALESCE(SUM(actual_micros),0) meteredMicros,COALESCE(SUM(CASE WHEN state IN('reserved','uncertain') THEN reserved_micros ELSE 0 END),0) reservedMicros,COALESCE(SUM(input_tokens),0) inputTokens,COALESCE(SUM(output_tokens),0) outputTokens FROM penny_ai_runs WHERE month=?").bind(month).first()
 return {month,...usage}
}
