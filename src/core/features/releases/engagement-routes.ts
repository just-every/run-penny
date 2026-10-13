import type { Hono } from 'hono'
import { z } from 'zod'
import { mutationFailure,parseMutationBody,requireOperator,type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { requireRequesterIdentity } from '../auth/requester'
import { parseInput } from '../auth/native-routes'
import { changeSubscription,readSubscription } from './subscription'
import { correctionSchema,correctRelease,releaseOperatorGuard,releaseVersions,requestReleaseDelivery } from './versioning'
import { outcomeSchema,recordOutcome,releaseOutcomeReport,requesterOutcomes } from './outcomes'
export function registerReleaseEngagementRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/public/updates/subscription',async c=>{
  const runtime=c.get('runtime'),identity=await requireRequesterIdentity(runtime,c.req.raw)
  return c.json(await readSubscription(runtime.database.binding,identity))
 })
 app.patch('/api/public/updates/subscription',async c=>{
  const runtime=c.get('runtime'),identity=await requireRequesterIdentity(runtime,c.req.raw),input=await parseInput(c.req.raw,z.object({subscribed:z.boolean()}).strict())
  return c.json(await changeSubscription(runtime.database,identity,input.subscribed))
 })
 app.get('/api/public/releases/:slug/outcomes',async c=>{
  const runtime=c.get('runtime'),identity=await requireRequesterIdentity(runtime,c.req.raw)
  try{return c.json(await requesterOutcomes(runtime.database.binding,c.req.param('slug'),identity))}catch(e){return mutationFailure(c,e)}
 })
 app.put('/api/public/releases/:slug/outcomes',async c=>{
  const runtime=c.get('runtime'),identity=await requireRequesterIdentity(runtime,c.req.raw),input=await parseInput(c.req.raw,outcomeSchema)
  try{return c.json(await recordOutcome(runtime.database,c.req.param('slug'),identity,input))}catch(e){return mutationFailure(c,e)}
 })
 app.get('/api/operator/releases/:slug/versions',async c=>{
  if(!await requireOperator(c))return c.json({authenticated:false},401)
  try{return c.json(await releaseVersions(c.get('runtime').database.binding,c.req.param('slug')))}catch(e){return mutationFailure(c,e)}
 })
 app.get('/api/operator/releases/:slug/outcomes',async c=>{
  if(!await requireOperator(c))return c.json({authenticated:false},401)
  try{return c.json(await releaseOutcomeReport(c.get('runtime').database.binding,c.req.param('slug')))}catch(e){return mutationFailure(c,e)}
 })
 app.post('/api/operator/releases/:slug/corrections',async c=>{
  if(!await requireOperator(c))return c.json({authenticated:false},401)
  const input=await parseMutationBody(c,correctionSchema);if(!input)return c.json({message:'Provide the current version, a title, body and valid optional usage link.'},400)
  try{return c.json(await correctRelease(c.get('runtime').database.binding,c.req.param('slug'),input,await releaseOperatorGuard(c.get('runtime'),c.req.raw)),201)}catch(e){return mutationFailure(c,e)}
 })
 app.post('/api/operator/releases/:slug/versions/:versionId/deliver',async c=>{
  if(!await requireOperator(c))return c.json({authenticated:false},401)
  try{return c.json(await requestReleaseDelivery(c.get('runtime').database.binding,c.req.param('slug'),c.req.param('versionId'),await releaseOperatorGuard(c.get('runtime'),c.req.raw)))}catch(e){return mutationFailure(c,e)}
 })
}
