import {z} from 'zod'
import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {integrationOperator} from '../integrations/destinations'
import {NativeError} from '../auth/native-tokens'
import {parseInput} from '../auth/native-routes'
import {capabilities,providers,provider,settings,costReport} from './configuration'
export const aiSettingsInput=z.object({monthlyBudgetMicros:z.number().int().min(0).max(100000000000),includePrivate:z.boolean(),choices:z.array(z.object({capability:z.enum(Object.keys(capabilities) as [keyof typeof capabilities,...(keyof typeof capabilities)[]]),provider,model:z.string().min(1).max(160)}).strict()).max(16)}).strict()
export function registerAiRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/settings/ai',async c=>{
  const runtime=c.get('runtime'),{db,session}=await integrationOperator(runtime,c.req.raw),s=await settings(db),all=providers(runtime),rows=(await db.prepare('SELECT * FROM penny_ai_capabilities').all<{capability:string;provider:string;model:string}>()).results
  return c.json({canConfigure:session.operator.role==='owner',monthlyBudgetMicros:s.monthly_budget_micros,includePrivate:!!s.include_private,report:await costReport(db),capabilities:Object.entries(capabilities).map(([id,label])=>({id,label,provider:rows.find(r=>r.capability===id)?.provider??'anthropic',model:rows.find(r=>r.capability===id)?.model??all.anthropic?.models[0]?.id??''})),catalog:Object.entries(all).flatMap(([provider,c])=>(c?.models??[]).map(m=>({provider,...m}))),transport:!!runtime.bindings.PENNY_LEARNING_EGRESS})
 })
 app.put('/api/operator/settings/ai',async c=>{
  const runtime=c.get('runtime'),{db,session}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')throw new NativeError('ai_owner_required',403)
  const input=await parseInput(c.req.raw,aiSettingsInput),all=providers(runtime)
  if(new Set(input.choices.map(c=>c.capability)).size!==input.choices.length||input.choices.some(c=>!all[c.provider]?.models.some(m=>m.id===c.model)))throw new NativeError('ai_model_unconfigured',409)
  await db.batch([db.prepare('DELETE FROM penny_ai_capabilities'),db.prepare('INSERT INTO penny_ai_settings(singleton,monthly_budget_micros,include_private) VALUES(1,?,?) ON CONFLICT(singleton) DO UPDATE SET monthly_budget_micros=excluded.monthly_budget_micros,include_private=excluded.include_private').bind(input.monthlyBudgetMicros,input.includePrivate?1:0),...input.choices.map(c=>db.prepare('INSERT INTO penny_ai_capabilities(capability,provider,model) VALUES(?,?,?) ON CONFLICT(capability) DO UPDATE SET provider=excluded.provider,model=excluded.model').bind(c.capability,c.provider,c.model))])
  return c.json({saved:true})
 })
}
