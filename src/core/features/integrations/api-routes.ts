import {agentRest} from '../agent-door/rest'
import { proxyVoteSchema } from '../requests/proxy-votes'
import { publicRequestFiltersSchema } from '../portal/routes'
import { statusPublicationSchema } from '../requests/status-schema'
import {revokeKey} from './revocation'
import type {Hono} from 'hono'
import {z} from 'zod'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {parseInput} from '../auth/native-routes'
import {NativeError} from '../auth/native-tokens'
import {releaseDraftSchema} from '../releases/drafts'
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
  await apiAuthority(c.get('runtime'),c.req.raw,'votes:write','proxy-vote-contacts')
  return agentRest(c.get('runtime'),c.req.raw,'votes.contacts',{q})
 })
 app.post('/api/v1/requests/:slug/proxy-votes',async c=>{
  const key=slug.parse(c.req.param('slug'));await apiAuthority(c.get('runtime'),c.req.raw,'votes:write','proxy-votes');const input=await parseInput(c.req.raw,proxyVoteSchema)
  return agentRest(c.get('runtime'),c.req.raw,'votes.record_proxy',{slug:key,vote:input})
 })
 app.get('/api/v1/boards',async c=>{await apiAuthority(c.get('runtime'),c.req.raw,'requests:read','boards');return agentRest(c.get('runtime'),c.req.raw,'boards.public',{})})
 app.get('/api/v1/requests',async c=>{await apiAuthority(c.get('runtime'),c.req.raw,'requests:read','requests');const filters=publicRequestFiltersSchema.safeParse(Object.fromEntries(Object.entries(c.req.query()).filter(([,value])=>value!=='')));if(!filters.success)throw new NativeError('validation_failed',400);return agentRest(c.get('runtime'),c.req.raw,'requests.public',{filters:filters.data})})
 app.get('/api/v1/requests/:slug',async c=>{
  const key=slug.parse(c.req.param('slug'));await apiAuthority(c.get('runtime'),c.req.raw,'requests:read','requests')
  return agentRest(c.get('runtime'),c.req.raw,'requests.public',{slug:key})
 })
 for(const [path,scope,tool] of [['comments','comments:read','comments.public'],['status-updates','status:read','status.public']] as const)app.get('/api/v1/requests/:slug/'+path,async c=>{
  const key=slug.parse(c.req.param('slug'));await apiAuthority(c.get('runtime'),c.req.raw,scope,path)
  return agentRest(c.get('runtime'),c.req.raw,tool,{slug:key})
 })
 app.post('/api/v1/requests',async c=>{
  await apiAuthority(c.get('runtime'),c.req.raw,'requests:write','requests');const input=await parseInput(c.req.raw,create)
  if(new Set(input.evidenceIds).size!==input.evidenceIds.length)throw new NativeError('validation_failed',400)
  return agentRest(c.get('runtime'),c.req.raw,'requests.create',input,201)
 })
 app.post('/api/v1/requests/:slug/comments',async c=>{
  const key=slug.parse(c.req.param('slug'));await apiAuthority(c.get('runtime'),c.req.raw,'comments:write','comments');const input=await parseInput(c.req.raw,comment)
  return agentRest(c.get('runtime'),c.req.raw,'comments.post',{slug:key,body:input.body},201)
 })
 app.post('/api/v1/requests/:slug/status-updates',async c=>{
  const key=slug.parse(c.req.param('slug'));await apiAuthority(c.get('runtime'),c.req.raw,'status:write','status-updates');const input=await parseInput(c.req.raw,status)
  const {approve:_,...update}=input
  return agentRest(c.get('runtime'),c.req.raw,'requests.set_status',{slug:key,update})
 })
 app.get('/api/v1/releases',async c=>{await apiAuthority(c.get('runtime'),c.req.raw,'releases:read','releases');return agentRest(c.get('runtime'),c.req.raw,'releases.public',{})})
 app.get('/api/v1/releases/:slug',async c=>{
  const key=slug.parse(c.req.param('slug'));await apiAuthority(c.get('runtime'),c.req.raw,'releases:read','releases')
  return agentRest(c.get('runtime'),c.req.raw,'releases.public',{slug:key})
 })
 app.post('/api/v1/releases',async c=>{
  await apiAuthority(c.get('runtime'),c.req.raw,'releases:write','releases');const input=await parseInput(c.req.raw,releaseDraftSchema.omit({authorOperatorId:true}))
  return agentRest(c.get('runtime'),c.req.raw,'releases.draft',{draft:input},201)
 })
 app.post('/api/v1/releases/:slug/publish',async c=>{
  const key=slug.parse(c.req.param('slug'));await apiAuthority(c.get('runtime'),c.req.raw,'releases:write','releases');await parseInput(c.req.raw,z.object({approve:z.literal(true)}).strict())
  return agentRest(c.get('runtime'),c.req.raw,'releases.publish',{slug:key})
 })
 app.all('/api/v1/*',c=>c.json({error:'integration_route_not_found'},404))
}
