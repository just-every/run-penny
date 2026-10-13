import type { Hono } from 'hono'
import { z } from 'zod'
import { parseMutationBody, requireOperator, type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { decisionDatabase } from '../decisions/authority'
import { createUlid } from '@/core/shared/ulid'
import { canonicalCustomFieldEntityType, customFieldEntityTables, customFieldEntityExists, customFieldEntityTypeAliases, isCustomFieldValue, type CustomFieldType } from './custom-field-types'

const valueInput = z.object({
  value: z.union([z.string().max(20_000), z.number().finite(), z.boolean(), z.null()]),
}).strict()

export function registerCustomFieldValueRoutes(app: Hono<OperatorMutationEnvironment>): void {
  app.get('/api/operator/custom-fields/:entityType/:entityId', async context => {
    if (!await requireOperator(context)) return context.json({ authenticated: false }, 401)
    context.header('Cache-Control', 'no-store')
    const entityType = canonicalCustomFieldEntityType(context.req.param('entityType'))
    if (!entityType) return context.json({ error: 'validation_failed' }, 400)
    const db = await decisionDatabase(context.get('runtime'), context.req.raw)
    const entityId = context.req.param('entityId')
    if (!await customFieldEntityExists(db, entityType, entityId)) return context.json({ error: 'not_found' }, 404)
    const aliases = customFieldEntityTypeAliases(entityType)
    const rows = await db.prepare(`SELECT d.id,d.name,d.entity_type AS entityType,d.field_type AS fieldType,
      v.id IS NOT NULL AS hasValue,v.value_json AS valueJson
      FROM custom_field_definitions d LEFT JOIN custom_field_values v ON v.definition_id=d.id AND v.entity_id=?
      WHERE d.entity_type IN (?,?) ORDER BY d.name,d.id`)
      .bind(entityId, aliases[0], aliases[1]).all<{
        id: string
        name: string
        entityType: string
        fieldType: string
        hasValue: number
        valueJson: string | null
      }>()
    return context.json(rows.results.map(({ valueJson, hasValue, ...field }) => ({
      ...field,
      entityType: canonicalCustomFieldEntityType(field.entityType) ?? field.entityType,
      hasValue: Boolean(hasValue),
      value: valueJson === null ? null : JSON.parse(valueJson) as unknown,
    })))
  })

  app.put('/api/operator/custom-fields/:entityType/:definitionId/:entityId', async context => {
    const operator = await requireOperator(context)
    if (!operator) return context.json({ authenticated: false }, 401)
    context.header('Cache-Control', 'no-store')
    const db = await decisionDatabase(context.get('runtime'), context.req.raw)
    const input = await parseMutationBody(context, valueInput)
    if (!input) return context.json({ error: 'validation_failed' }, 400)

    const entityType = canonicalCustomFieldEntityType(context.req.param('entityType'))
    if (!entityType) return context.json({ error: 'validation_failed' }, 400)
    const entityId = context.req.param('entityId')
    const definition = await db.prepare('SELECT entity_type AS entityType,field_type AS fieldType FROM custom_field_definitions WHERE id=?')
      .bind(context.req.param('definitionId')).first<{ entityType: string; fieldType: string }>()
    if (!definition) return context.json({ error: 'not_found' }, 404)
    const definitionType = canonicalCustomFieldEntityType(definition.entityType)
    if (!definitionType || definitionType !== entityType) return context.json({ error: 'entity_type_mismatch' }, 409)
    if (!await customFieldEntityExists(db, entityType, entityId)) return context.json({ error: 'not_found' }, 404)
    if (!isCustomFieldValue(definition.fieldType as CustomFieldType, input.value)) return context.json({ error: 'invalid_field_value' }, 400)

    // Keep the validated definition and target existence true at the actual write.
    const eligibility = `EXISTS(SELECT 1 FROM custom_field_definitions WHERE id=? AND entity_type=? AND field_type=?)
      AND EXISTS(SELECT 1 FROM ${customFieldEntityTables[entityType]} WHERE id=?)`
    const eligibilityParams = [context.req.param('definitionId'), definition.entityType, definition.fieldType, entityId]
    const now = new Date().toISOString()
    const valueWrite = db.prepare(`INSERT INTO custom_field_values(id,definition_id,entity_id,value_json,created_at,updated_at)
      SELECT ?,?,?,?,?,? WHERE ${eligibility} ON CONFLICT(definition_id,entity_id) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at RETURNING id`)
      .bind(createUlid(), context.req.param('definitionId'), entityId, JSON.stringify(input.value), now, now, ...eligibilityParams)
    let results: D1Result[]
    if (input.value === null) {
      const entityAliases = customFieldEntityTypeAliases(entityType)
      results = await db.batch([
        db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at)
          SELECT ?,'operator',?,'custom_field.value_cleared',?, ?,json_object('definitionId',?),?,?,?
          WHERE EXISTS(SELECT 1 FROM custom_field_values WHERE definition_id=? AND entity_id=? AND value_json<>'null')
            AND ${eligibility}`)
          .bind(createUlid(), operator.id, entityAliases[0], entityId, context.req.param('definitionId'), now, now, now, context.req.param('definitionId'), entityId, ...eligibilityParams),
        valueWrite,
      ])
    } else {
      results = await db.batch([valueWrite])
    }
    if (results.at(-1)!.results.length !== 1) return context.json({ error: 'field_or_entity_changed' }, 409)
    return context.json({ ok: true, entityType, entityId, definitionId: context.req.param('definitionId'), value: input.value })
  })
}
