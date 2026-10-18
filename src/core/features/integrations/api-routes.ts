import { recordProxyVote,proxyVoteSchema,proxyContacts } from '../requests/proxy-votes'
import { publicRequestFiltersSchema } from '../portal/routes'
import { statusPublicationSchema } from '../requests/status-schema'
import {revokeKey} from './revocation'
import type {Hono} from 'hono'
import {z} from 'zod'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {parseInput} from '../auth/native-routes'
import {NativeError} from '../auth/native-tokens'
import {portalReadService} from '../portal/service'
import {createOperatorRequest,postOperatorComment} from '../requests/operator-context'
import {RequestOperatorRepository} from '../requests/operator-repository'
import {saveReleaseDraft,releaseDraftSchema} from '../releases/drafts'
import {publishRelease} from '../releases/publication'
import {apiAuthority,apiScopes,managedKeys} from './keys'
const text=z.string().trim().min(1).max(20000),slug=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128)
const create=z.object({title:z.string().trim().min(1).max(280),description:text,boardSlug:slug,evidenceIds:z.array(z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/)).max(100).default([])}).strict()
const comment=z.object({body:text,approve:z.literal(true)}).strict()
const status=statusPublicationSchema.extend({idempotencyKey:z.string().regex(/^[A-Za-z0-9_-]+$/).min(1).max(128),approve:z.literal(true)}).strict()
const issue=z.object({name:z.string().trim().min(1).max(200),scopes:z.array(z.enum(apiScopes)).min(1),expiresAt:z.number().int().optional()}).strict()
export function registerIntegrationApi(app:Hono<OperatorMutationEnvironment>) {
 app.use('/api/v1/*',async(c,next)=>{c.header('Cache-Control','private, no-store');await next()})
 app.use('/api/operator/integrations/*',async(c,next)=>{c.header('Cache-Control','private, no-store');await next()})
 app.get('/api/operator/integrations/keys',async c=>{
  const service=await managedKeys(c.get('runtime'),c.req.raw)
  return c.json({keys:await service.list(null),usage:await service.usage(null),scopes:apiScopes})
 })
 app.post('/api/operator/integrations/keys',async c=>{
  const input=await parseInput(c.req.raw,issue),service=await managedKeys(c.get('runtime'),c.req.raw,true)
  try{return c.json(await service.issue(null,input),201)}catch(error){if(error instanceof NativeError)throw error;if(error instanceof Error&&/Invalid token expiry|Token grant rejected/.test(error.message))throw new NativeError('integration_key_refused',422);throw error}
 })
 app.delete('/api/operator/integrations/keys/:id',async c=>{
  await revokeKey(c.get('runtime'),c.req.raw,c.req.param('id'));return c.json({revoked:true})
 })
 app.get('/api/v1/proxy-vote-contacts',async c=>{
  const q=c.req.query('q')??'';if(q.length>200)throw new NativeError('validation_failed',400)
  const auth=await apiAuthority(c.get('runtime'),c.req.raw,'votes:write','proxy-vote-contacts')
  return c.json(await proxyContacts(auth.database.binding,q))
 })
 app.post('/api/v1/requests/:slug/proxy-votes',async c=>{
  const key=slug.parse(c.req.param('slug')),auth=await apiAuthority(c.get('runtime'),c.req.raw,'votes:write','proxy-votes'),input=await parseInput(c.req.raw,proxyVoteSchema)
  return c.json(await recordProxyVote(auth.database.binding,key,input,auth.actor.id))
 })
 app.get('/api/v1/boards',async c=>{const auth=await apiAuthority(c.get('runtime'),c.req.raw,'requests:read','boards');return c.json(await portalReadService(auth.database).listBoards())})
 app.get('/api/v1/requests',async c=>{const auth=await apiAuthority(c.get('runtime'),c.req.raw,'requests:read','requests');const filters=publicRequestFiltersSchema.safeParse(Object.fromEntries(Object.entries(c.req.query()).filter(([,value])=>value!=='')));if(!filters.success)throw new NativeError('validation_failed',400);return c.json(await portalReadService(auth.database).listRequests(filters.data))})
 app.get('/api/v1/requests/:slug',async c=>{
  const key=slug.parse(c.req.param('slug')),auth=await apiAuthority(c.get('runtime'),c.req.raw,'requests:read','requests')
  const result=await portalReadService(auth.database).getRequest(key)
  if(result.kind==='not_found')throw new NativeError('not_found',404)
  return c.json(result)
 })
 for(const [path,scope,field] of [['comments','comments:read','comments'],['status-updates','status:read','statusUpdates']] as const)app.get('/api/v1/requests/:slug/'+path,async c=>{
  const key=slug.parse(c.req.param('slug')),auth=await apiAuthority(c.get('runtime'),c.req.raw,scope,path),result=await portalReadService(auth.database).getRequest(key)
  if(result.kind!=='found')throw new NativeError('not_found',404)
  return c.json(result.request[field])
 })
 app.post('/api/v1/requests',async c=>{
  const auth=await apiAuthority(c.get('runtime'),c.req.raw,'requests:write','requests'),input=await parseInput(c.req.raw,create)
  if(new Set(input.evidenceIds).size!==input.evidenceIds.length)throw new NativeError('validation_failed',400)
  return c.json(await createOperatorRequest(auth.database,input,auth.actor.id),201)
 })
 app.post('/api/v1/requests/:slug/comments',async c=>{
  const key=slug.parse(c.req.param('slug')),auth=await apiAuthority(c.get('runtime'),c.req.raw,'comments:write','comments'),input=await parseInput(c.req.raw,comment)
  return c.json(await postOperatorComment(auth.database,key,input.body,auth.actor),201)
 })
 app.post('/api/v1/requests/:slug/status-updates',async c=>{
  const key=slug.parse(c.req.param('slug')),auth=await apiAuthority(c.get('runtime'),c.req.raw,'status:write','status-updates'),input=await parseInput(c.req.raw,status)
  await new RequestOperatorRepository(auth.database).publishStatusUpdate({...input,slug:key,operatorId:auth.actor.id,now:new Date().toISOString(),appOrigin:c.get('runtime').configuration.appOrigin})
  return c.json({published:true})
 })
 app.get('/api/v1/releases',async c=>{const auth=await apiAuthority(c.get('runtime'),c.req.raw,'releases:read','releases');return c.json(await portalReadService(auth.database).listReleases())})
 app.get('/api/v1/releases/:slug',async c=>{
  const key=slug.parse(c.req.param('slug')),auth=await apiAuthority(c.get('runtime'),c.req.raw,'releases:read','releases'),result=await portalReadService(auth.database).getRelease(key)
  if(!result)throw new NativeError('not_found',404);return c.json(result)
 })
 app.post('/api/v1/releases',async c=>{
  const auth=await apiAuthority(c.get('runtime'),c.req.raw,'releases:write','releases'),input=await parseInput(c.req.raw,releaseDraftSchema.omit({authorOperatorId:true}))
  return c.json(await saveReleaseDraft(auth.database.binding,{...input,authorOperatorId:auth.actor.id},undefined,undefined,auth.actor.id),201)
 })
 app.post('/api/v1/releases/:slug/publish',async c=>{
  const key=slug.parse(c.req.param('slug')),auth=await apiAuthority(c.get('runtime'),c.req.raw,'releases:write','releases');await parseInput(c.req.raw,z.object({approve:z.literal(true)}).strict())
  return c.json(await publishRelease(auth.database.binding,key,undefined,auth.actor.id))
 })
 app.all('/api/v1/*',c=>c.json({error:'integration_route_not_found'},404))
}
