import type { Hono } from 'hono'
import { z } from 'zod'
import { parseMutationBody, requireOperator, type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { decisionDatabase } from '../decisions/authority'
import { createUlid } from '@/core/shared/ulid'
import { canonicalCustomFieldEntityType, customFieldEntityTypeAliases } from './custom-field-types'
import { customFieldValueCompatibilitySql } from './custom-field-compatibility'

const entityTypeSchema = z.enum(['account', 'requester', 'evidence', 'request', 'decision', 'roadmapItem', 'release', 'roadmap'])
const definitionInput = z.object({
  entityType: entityTypeSchema,
  name: z.string().trim().min(1).max(160),
  fieldType: z.enum(['text', 'number', 'boolean', 'date']),
}).strict()
const definitionUpdate = z.object({
  name: z.string().trim().min(1).max(160),
  fieldType: z.enum(['text', 'number', 'boolean', 'date']),
}).strict()

export function registerCustomFieldDefinitionRoutes(app: Hono<OperatorMutationEnvironment>): void {
  app.get('/api/operator/settings/custom-fields', async context => {
    if (!await requireOperator(context)) return context.json({ authenticated: false }, 401)
    context.header('Cache-Control', 'no-store')
    const db = await decisionDatabase(context.get('runtime'), context.req.raw)
    const result = await db.prepare(
      'SELECT id,entity_type AS entityType,name,field_type AS fieldType FROM custom_field_definitions ORDER BY entity_type,name,id',
    ).all<{ id: string; entityType: string; name: string; fieldType: string }>()
    return context.json(result.results.map(field => ({
      ...field,
      entityType: canonicalCustomFieldEntityType(field.entityType) ?? field.entityType,
    })))
  })

  app.post('/api/operator/settings/custom-fields', async context => {
    const operator = await requireOperator(context)
    if (!operator) return context.json({ authenticated: false }, 401)
    context.header('Cache-Control', 'no-store')
    const db = await decisionDatabase(context.get('runtime'), context.req.raw)
    const input = await parseMutationBody(context, definitionInput)
    if (!input) return context.json({ error: 'validation_failed' }, 400)

    const entityType = canonicalCustomFieldEntityType(input.entityType)!
    const aliases = customFieldEntityTypeAliases(entityType)
    const id = createUlid()
    const now = new Date().toISOString()
    try {
      const results = await db.batch([
        db.prepare(`INSERT INTO custom_field_definitions(id,entity_type,name,field_type,created_at,updated_at)
          SELECT ?,?,?,?,?,? WHERE NOT EXISTS(
            SELECT 1 FROM custom_field_definitions WHERE entity_type IN (?,?) AND name=?
          ) RETURNING id`).bind(id, entityType, input.name, input.fieldType, now, now, aliases[0], aliases[1], input.name),
        db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at)
          SELECT ?,'operator',?,'custom_field.definition_created','custom_field_definition',?,json_object('name',?,'fieldType',?),?,?,? WHERE changes()=1`)
          .bind(createUlid(), operator.id, id, input.name, input.fieldType, now, now, now),
      ])
      if (results[0].results.length !== 1) return context.json({ error: 'field_exists' }, 409)
      return context.json({ id, entityType, name: input.name, fieldType: input.fieldType }, 201)
    } catch (error) {
      if (String(error).includes('UNIQUE constraint')) return context.json({ error: 'field_exists' }, 409)
      throw error
    }
  })

  app.patch('/api/operator/settings/custom-fields/:definitionId', async context => {
    const operator = await requireOperator(context)
    if (!operator) return context.json({ authenticated: false }, 401)
    context.header('Cache-Control', 'no-store')
    const db = await decisionDatabase(context.get('runtime'), context.req.raw)
    const input = await parseMutationBody(context, definitionUpdate)
    if (!input) return context.json({ error: 'validation_failed' }, 400)

    const definitionId = context.req.param('definitionId')
    const current = await db.prepare('SELECT id,entity_type AS entityType,name,field_type AS fieldType FROM custom_field_definitions WHERE id=?')
      .bind(definitionId).first<{ id: string; entityType: string; name: string; fieldType: string }>()
    if (!current) return context.json({ error: 'not_found' }, 404)
    const entityType = canonicalCustomFieldEntityType(current.entityType)
    if (!entityType) return context.json({ error: 'not_found' }, 404)

    if (current.name === input.name && current.fieldType === input.fieldType) {
      return context.json({ ok: true, id: definitionId, entityType, ...input })
    }

    const aliases = customFieldEntityTypeAliases(entityType)
    const now = new Date().toISOString()
    try {
      const results = await db.batch([
        // Validate transaction-current values without aggregating or returning
        // them. The indexed NOT EXISTS scan stops at the first incompatible row.
        db.prepare(`UPDATE custom_field_definitions SET name=?,field_type=?,updated_at=? WHERE id=? AND NOT EXISTS(
          SELECT 1 FROM custom_field_definitions WHERE entity_type IN (?,?) AND name=? AND id<>?
        ) AND name=? AND field_type=? AND entity_type=?
          AND (field_type=? OR NOT EXISTS(
            SELECT 1 FROM custom_field_values v WHERE v.definition_id=custom_field_definitions.id
              AND NOT (${customFieldValueCompatibilitySql(input.fieldType)})
          )) RETURNING id`).bind(input.name, input.fieldType, now, definitionId, aliases[0], aliases[1], input.name, definitionId,
            current.name, current.fieldType, current.entityType, input.fieldType),
        db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at)
          SELECT ?,'operator',?,'custom_field.definition_updated','custom_field_definition',?,json_object('previousName',?,'name',?,'previousFieldType',?,'fieldType',?),?,?,? WHERE changes()=1`)
          .bind(createUlid(), operator.id, definitionId, current.name, input.name, current.fieldType, input.fieldType, now, now, now),
      ])
      if (results[0].results.length !== 1) {
        const stillExists = await db.prepare('SELECT id FROM custom_field_definitions WHERE id=?').bind(definitionId).first()
        return stillExists ? context.json({ error: 'field_conflict' }, 409) : context.json({ error: 'not_found' }, 404)
      }
      return context.json({ ok: true, id: definitionId, entityType, ...input })
    } catch (error) {
      if (String(error).includes('UNIQUE constraint')) return context.json({ error: 'field_exists' }, 409)
      throw error
    }
  })
}
