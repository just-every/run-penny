import {z} from 'zod'
import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import type {PennyRuntime} from '@/core/app/runtime'
import {integrationOperator} from '../integrations/destinations'
import {NativeError} from '../auth/native-tokens'
import {parseInput} from '../auth/native-routes'
import {viewInput,viewKinds,definitionQuery,type ViewKind} from './definition'
import {listViews,readView,saveView,deleteView,validateReferences} from './repository'
import type {ListQuery} from '../workspace/list-query'
import {pagedList,pagedModeration} from '../workspace/paged-service'

export async function viewList(runtime:PennyRuntime,request:Request,kind:ViewKind,query:ListQuery,moderation=false){
 const {db,actor,session}=await integrationOperator(runtime,request),viewer={id:actor.id,role:session.operator.role}
 const view=query.view?await readView(db,query.view,viewer):undefined
 if(view&&view.listKind!==kind)throw new NativeError('saved_view_wrong_list',400)
 const effective=view?{...definitionQuery(view),view:view.id,page:query.page}:query
 if(!view)await validateReferences(db,{listKind:kind,filter:effective},false)
 if(view?.removedFilters.length)return {items:[],total:0,page:query.page??1,pageSize:25,savedView:view}
 const database={binding:db},page=moderation?await pagedModeration(database,effective):await pagedList(database,kind,effective)
 const releaseWindows=kind==='roadmap'?(await db.prepare(`SELECT i.roadmap_item_id AS itemId,p.name,p.release_date AS releaseDate FROM penny_release_plan_items i JOIN penny_release_plans p ON p.id=i.plan_id WHERE i.roadmap_item_id IN (${page.items.length?page.items.map(()=>'?').join(','):'NULL'}) ORDER BY p.release_date,p.id`).bind(...page.items.map(row=>row.id)).all()).results:undefined
 return {...page,...(view?{savedView:view}:{}),...(releaseWindows?{releaseWindows}:{})}
}
export function registerViewRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/saved-views',async c=>{
  const kind=z.enum(viewKinds).safeParse(c.req.query('listKind'));if(!kind.success)throw new NativeError('saved_view_list_invalid',400)
  const {db,actor,session}=await integrationOperator(c.get('runtime'),c.req.raw)
  c.header('Cache-Control','private, no-store');return c.json(await listViews(db,kind.data,{id:actor.id,role:session.operator.role}))
 })
 app.get('/api/operator/saved-views/:id',async c=>{
  const {db,actor,session}=await integrationOperator(c.get('runtime'),c.req.raw)
  c.header('Cache-Control','private, no-store');return c.json(await readView(db,c.req.param('id'),{id:actor.id,role:session.operator.role}))
 })
 app.post('/api/operator/saved-views',async c=>{
  const {db,actor,session}=await integrationOperator(c.get('runtime'),c.req.raw),input=await parseInput(c.req.raw,viewInput)
  return c.json(await saveView(db,null,input,{id:actor.id,role:session.operator.role}),201)
 })
 app.put('/api/operator/saved-views/:id',async c=>{
  const {db,actor,session}=await integrationOperator(c.get('runtime'),c.req.raw),input=await parseInput(c.req.raw,viewInput)
  return c.json(await saveView(db,c.req.param('id'),input,{id:actor.id,role:session.operator.role}))
 })
 app.delete('/api/operator/saved-views/:id',async c=>{
  const {db,actor,session}=await integrationOperator(c.get('runtime'),c.req.raw),input=await parseInput(c.req.raw,z.object({revision:z.number().int().positive()}).strict())
  await deleteView(db,c.req.param('id'),{id:actor.id,role:session.operator.role},input.revision);return c.json({deleted:true})
 })
}
