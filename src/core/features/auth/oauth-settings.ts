import {z} from 'zod'
import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {integrationOperator} from '../integrations/destinations'
import {guardedDatabase} from '../integrations/guarded-database'
import {sessionGuard} from '../integrations/keys'
import {audit} from '../decisions/write-support'
import {parseInput} from './native-routes'
import {NativeError} from './native-tokens'
import {oauthProvider,oauthCredential} from './oauth-provider'
export function registerOAuthSettings(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/settings/requester-oauth',async c=>{
  const runtime=c.get('runtime'),{session}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')return c.json({canConfigure:false,providers:[]})
  const rows=(await runtime.database.binding.prepare('SELECT * FROM penny_requester_oauth').all<{provider:string;enabled:number}>()).results
  return c.json({canConfigure:true,providers:oauthProvider.options.map(provider=>({provider,enabled:rows.some(row=>row.provider===provider&&row.enabled===1),available:!!oauthCredential(runtime,provider)&&!!runtime.bindings.PENNY_LEARNING_EGRESS}))})
 })
 app.put('/api/operator/settings/requester-oauth',async c=>{
  const runtime=c.get('runtime'),{session,actor}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
  const input=await parseInput(c.req.raw,z.object({google:z.boolean(),github:z.boolean()}).strict())
  for(const provider of oauthProvider.options)if(input[provider]&&(!oauthCredential(runtime,provider)||!runtime.bindings.PENNY_LEARNING_EGRESS))throw new NativeError('oauth_binding_required',409,`${provider==='google'?'Google':'GitHub'} needs its installation client credentials and enforcing egress binding before it can be enabled.`)
  const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')";guard.params.push(session.operatorId)
  const db=guardedDatabase(runtime.database.binding,guard)
  await db.batch([...oauthProvider.options.map(provider=>db.prepare('INSERT INTO penny_requester_oauth(provider,enabled) VALUES(?,?) ON CONFLICT(provider) DO UPDATE SET enabled=excluded.enabled').bind(provider,input[provider]?1:0)),db.prepare('DELETE FROM penny_requester_oauth_states WHERE provider IN(SELECT provider FROM penny_requester_oauth WHERE enabled=0)'),audit(db,actor.id,'settings','requester-oauth','requester.oauth_configured',new Date().toISOString())])
  return c.json({saved:true})
 })
}
