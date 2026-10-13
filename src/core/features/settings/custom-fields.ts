import type { Hono } from 'hono'
import { z } from 'zod'
import { parseMutationBody, requireOperator, type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'

const entities = { account:'accounts',request:'requests',evidence:'evidence_items',decision:'decisions',roadmapItem:'roadmap_items',roadmap:'roadmap_items',release:'releases',requester:'requesters' } as const
const definitionSchema=z.object({entityType:z.enum(['account','request','evidence','decision','roadmapItem','roadmap','release','requester']),name:z.string().trim().min(1).max(160),fieldType:z.enum(['text','number','boolean','date'])}).strict()
export function registerCustomFieldRoutes(app:Hono<OperatorMutationEnvironment>):void {
  app.post('/api/operator/settings/custom-fields',async context=>{
    if(!await requireOperator(context))return context.json({authenticated:false},401)
    const input=await parseMutationBody(context,definitionSchema);if(!input)return context.json({error:'validation_failed'},400)
    const db=context.get('runtime').database.binding
    const entityType=input.entityType==='roadmap'?'roadmapItem':input.entityType
    if(await db.prepare('SELECT id FROM custom_field_definitions WHERE entity_type IN (?,?) AND name=?').bind(entityType,entityType==='roadmapItem'?'roadmap':entityType,input.name).first())return context.json({error:'field_exists'},409)
    const id=createUlid();const now=new Date().toISOString()
    await db.prepare('INSERT INTO custom_field_definitions (id,entity_type,name,field_type,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(id,entityType,input.name,input.fieldType,now,now).run()
    return context.json({id,...input,entityType},201)
  })
  app.get('/api/operator/custom-fields/:entityType/:entityId',async context=>{
    if(!await requireOperator(context))return context.json({authenticated:false},401)
    const entityType=context.req.param('entityType')
    if(!Object.hasOwn(entities,entityType))return context.json({error:'validation_failed'},400)
    const rows=await context.get('runtime').database.binding.prepare('SELECT d.id,d.name,d.field_type AS fieldType,v.value_json AS valueJson FROM custom_field_definitions d LEFT JOIN custom_field_values v ON v.definition_id=d.id AND v.entity_id=? WHERE d.entity_type IN (?,?) ORDER BY d.name').bind(context.req.param('entityId'),entityType,entityType==='roadmapItem'?'roadmap':entityType==='roadmap'?'roadmapItem':entityType).all<{id:string;name:string;fieldType:string;valueJson:string|null}>()
    return context.json(rows.results.map(({valueJson,...row})=>({...row,value:valueJson===null?null:JSON.parse(valueJson)})))
  })
  app.put('/api/operator/custom-fields/:definitionId/:entityId',async context=>{
    if(!await requireOperator(context))return context.json({authenticated:false},401)
    const input=await parseMutationBody(context,z.object({value:z.union([z.string().max(20000),z.number().finite(),z.boolean(),z.null()])}).strict());if(!input)return context.json({error:'validation_failed'},400)
    const db=context.get('runtime').database.binding;const definition=await db.prepare('SELECT entity_type AS entityType,field_type AS fieldType FROM custom_field_definitions WHERE id=?').bind(context.req.param('definitionId')).first<{entityType:keyof typeof entities;fieldType:string}>()
    if(!definition||!entities[definition.entityType])return context.json({error:'not_found'},404)
    if(!await db.prepare(`SELECT id FROM ${entities[definition.entityType]} WHERE id=?`).bind(context.req.param('entityId')).first())return context.json({error:'not_found'},404)
    if(input.value!==null && !(definition.fieldType==='date'?typeof input.value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(input.value) && !Number.isNaN(Date.parse(input.value)):typeof input.value===(definition.fieldType==='text'?'string':definition.fieldType)))return context.json({error:'invalid_field_value'},400)
    const now=new Date().toISOString()
    await db.prepare('INSERT INTO custom_field_values (id,definition_id,entity_id,value_json,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(definition_id,entity_id) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at').bind(createUlid(),context.req.param('definitionId'),context.req.param('entityId'),JSON.stringify(input.value),now,now).run()
    return context.json({ok:true})
  })
}
