import { customFieldEntityTypeAliases, type CustomFieldEntityType } from './custom-field-types'
import type { Resources, Json } from '@/core/app/resources.server'

/** Values for the records already admitted by the page's bounded list query. */
export async function fieldSnapshot(db: D1Database, type: CustomFieldEntityType, ids: string[]): Promise<Resources> {
  if (!ids.length) return {}
  const aliases = customFieldEntityTypeAliases(type)
  const rows = await db.prepare(`WITH selected(id) AS (SELECT value FROM json_each(?))
    SELECT selected.id AS entityId,d.id,d.name,d.field_type AS fieldType,
      v.id IS NOT NULL AS hasValue,v.value_json AS valueJson
    FROM selected CROSS JOIN custom_field_definitions d
    LEFT JOIN custom_field_values v ON v.definition_id=d.id AND v.entity_id=selected.id
    WHERE d.entity_type IN (?,?) ORDER BY d.name,d.id`)
    .bind(JSON.stringify(ids), ...aliases).all<{entityId:string;id:string;name:string;fieldType:string;hasValue:number;valueJson:string|null}>()
  return Object.fromEntries(ids.map(id => [`/api/operator/custom-fields/${type}/${encodeURIComponent(id)}`, {
    status: 200, data: rows.results.filter(row => row.entityId === id).map(({entityId:_,hasValue,valueJson,...field}) => ({
      ...field,entityType:type,hasValue:Boolean(hasValue),value:valueJson===null?null:JSON.parse(valueJson) as Json,
    })),
  }]))
}
