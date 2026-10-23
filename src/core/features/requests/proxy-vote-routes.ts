import type { Hono } from 'hono'
import { z } from 'zod'
import { mutationFailure,parseMutationBody,requireOperator,type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { decisionDatabase } from '../decisions/authority'
import { proxyVoteSchema,recordProxyVote,proxyContacts } from './proxy-votes'
import {ownerCsv} from '../data/csv-routes'
export function registerProxyVoteRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/proxy-votes/contacts',async c=>{
  if(!await requireOperator(c))return c.json({authenticated:false},401)
  const q=c.req.query('q')??'';if(q.length>200)return c.json({error:'validation_failed'},400)
  try{const db=await decisionDatabase(c.get('runtime'),c.req.raw)
   return c.json(await proxyContacts(db,q))
  }catch(error){return mutationFailure(c,error)}
 })
 app.get('/api/operator/votes/export.csv',async c=>{
  if(!await requireOperator(c))return c.json({authenticated:false},401)
  try{return await ownerCsv(c.get('runtime'),c.req.raw,'voters')}catch(error){return mutationFailure(c,error)}
 })
 app.post('/api/operator/requests/:slug/proxy-votes',async c=>{
  const actor=await requireOperator(c);if(!actor)return c.json({authenticated:false},401)
  const input=await parseMutationBody(c,proxyVoteSchema),slug=z.string().regex(/^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/).max(128).safeParse(c.req.param('slug'))
  if(!input||!slug.success)return c.json({error:'validation_failed',message:'Choose a customer and provide the source that justifies the vote.'},400)
  try{return c.json(await recordProxyVote(await decisionDatabase(c.get('runtime'),c.req.raw),slug.data,input,actor.id))}catch(error){return mutationFailure(c,error)}
 })
}
