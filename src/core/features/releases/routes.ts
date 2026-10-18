import { registerRichReleaseRoutes } from './rich-routes'
import { releaseLabels } from './rich-repository'
import {decisionDatabase} from '../decisions/authority'
import { registerReleaseEngagementRoutes } from './engagement-routes'
import type { Hono } from 'hono'
import { mutationFailure,parseMutationBody,requireOperator,type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { releaseDraftSchema,saveReleaseDraft } from './drafts'
import { publishRelease } from './publication'
import { discardStaleRoadmapUpdate } from '../roadmap/update-review'
import { publishRoadmapUpdate } from '../roadmap/update-publication'
export function registerReleaseMutationRoutes(app:Hono<OperatorMutationEnvironment>){
 registerRichReleaseRoutes(app)
 registerReleaseEngagementRoutes(app)
 app.get('/api/operator/releases/options',async c=>{
  if(!await requireOperator(c))return c.json({authenticated:false},401)
  const db=c.get('runtime').database.binding
  const [tags,operators,targets]=await Promise.all([db.prepare('SELECT id,name FROM tags ORDER BY name').all(),db.prepare('SELECT id,display_name AS name FROM operators ORDER BY display_name').all(),db.prepare(`SELECT i.id,p.public_title AS title,i.status FROM roadmap_items i JOIN roadmap_publications p ON p.roadmap_item_id=i.id WHERE p.approved_at IS NOT NULL AND p.withdrawn_at IS NULL AND i.decision_id IS NOT NULL AND EXISTS(SELECT 1 FROM roadmap_request_mappings m WHERE m.roadmap_item_id=i.id AND m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL) ORDER BY p.public_title`).all()])
  return c.json({tags:tags.results,operators:operators.results,targets:targets.results,products:(await db.prepare('SELECT id,name FROM penny_products ORDER BY name,id').all()).results,labels:await releaseLabels(db)})
 })
 for(const method of ['post','patch'] as const)app[method](method==='post'?'/api/operator/releases':'/api/operator/releases/:slug',async c=>{
  const actor=await requireOperator(c);if(!actor)return c.json({authenticated:false},401)
  const input=await parseMutationBody(c,releaseDraftSchema);if(!input)return c.json({message:'Provide a valid type, at least one tag, publication date, author, and optional http(s) URL.'},400)
  try{return c.json(await saveReleaseDraft(await decisionDatabase(c.get('runtime'),c.req.raw),input,method==='patch'?c.req.param('slug'):undefined,undefined,actor.id),method==='post'?201:200)}catch(e){return mutationFailure(c,e)}
 })
 app.post('/api/operator/releases/:slug/publish',async c=>{
  const actor=await requireOperator(c);if(!actor)return c.json({authenticated:false},401)
  try{return c.json(await publishRelease(await decisionDatabase(c.get('runtime'),c.req.raw),c.req.param('slug'),undefined,actor.id))}catch(e){return mutationFailure(c,e)}
 })
 app.post('/api/operator/roadmap-updates/:id/discard',async c=>{
  const actor=await requireOperator(c)
  if(!actor)return c.json({authenticated:false},401)
  try{return c.json(await discardStaleRoadmapUpdate(await decisionDatabase(c.get('runtime'),c.req.raw),c.req.param('id'),actor.id))}catch(e){return mutationFailure(c,e)}
 })
 app.post('/api/operator/roadmap-updates/:id/publish',async c=>{
  const actor=await requireOperator(c);if(!actor)return c.json({authenticated:false},401)
  try{return c.json(await publishRoadmapUpdate(await decisionDatabase(c.get('runtime'),c.req.raw),c.req.param('id'),undefined,actor.id))}catch(e){return mutationFailure(c,e)}
 })
}
