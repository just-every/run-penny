import {createUlid} from '@/core/shared/ulid'
import {z} from 'zod'
import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import type {PennyRuntime} from '@/core/app/runtime'
import branding from '@/branding.json'
import {integrationOperator} from '../integrations/destinations'
import {guardedDatabase} from '../integrations/guarded-database'
import {sessionGuard} from '../integrations/keys'
import {NativeError} from '../auth/native-tokens'
import {parseInput} from '../auth/native-routes'
function readableAccent(hex:string){
 const values=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4)
 return 1.05/(.2126*values[0]+.7152*values[1]+.0722*values[2]+.05)>=4.5
}
export const brandingInput=z.object({description:z.string().trim().min(1).max(300),accent:z.string().regex(/^#[a-fA-F0-9]{6}$/).refine(readableAccent),showLogo:z.boolean()}).strict()
export async function portalBranding(runtime:PennyRuntime){
 const row=await runtime.database.binding.prepare('SELECT description,accent,show_logo FROM penny_portal_branding WHERE singleton=1').first<{description:string;accent:string;show_logo:number}>()
 return {description:row?.description??branding.description,accent:row?.accent??branding.accent,showLogo:row?Boolean(row.show_logo):branding.logo==='penny-mark'}
}
export function registerBrandingRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/public/branding',async c=>c.json(await portalBranding(c.get('runtime'))))
 app.get('/api/operator/settings/branding',async c=>{const {session}=await integrationOperator(c.get('runtime'),c.req.raw);return c.json({...await portalBranding(c.get('runtime')),owner:session.operator.role==='owner'})})
 app.put('/api/operator/settings/branding',async c=>{
  const input=await parseInput(c.req.raw,brandingInput),runtime=c.get('runtime'),{session,actor}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
  const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')";guard.params.push(session.operatorId)
  const db=guardedDatabase(runtime.database.binding,guard),now=new Date().toISOString()
  await db.batch([db.prepare('INSERT INTO penny_portal_branding(singleton,description,accent,show_logo,updated_at) VALUES(1,?,?,?,?) ON CONFLICT(singleton) DO UPDATE SET description=excluded.description,accent=excluded.accent,show_logo=excluded.show_logo,updated_at=excluded.updated_at').bind(input.description,input.accent,Number(input.showLogo),Date.now()),
   db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,'portal.branding_replaced','settings','branding',?,?,?)`).bind(createUlid(),actor.id,now,now,now),
  ])
  return c.json({saved:true})
 })
}
