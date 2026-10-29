import { z } from 'zod'
import type { JsonSchemaObject } from '../../../../base/modules/agent-door/index.ts'

/** Preserve Zod's nonempty record-key constraint using supported JSON Schema. */
export function inputSchema(schema: z.ZodObject): JsonSchemaObject {
  const value = z.toJSONSchema(schema, { io: 'input' })
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach(visit); return }
    const object = node as Record<string, unknown>
    if (object.propertyNames) {
      const names = object.propertyNames as Record<string, unknown>
      if (Object.keys(names).some(key => !['type','minLength'].includes(key)) || names.type !== 'string' || names.minLength !== 1) throw new Error('Unsupported native record key schema')
      object.patternProperties = { '^[\\s\\S]+$': object.additionalProperties }
      object.additionalProperties = false
      delete object.propertyNames
    }
    Object.values(object).forEach(visit)
  }
  visit(value)
  return value as JsonSchemaObject
}
