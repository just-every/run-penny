export const customFieldEntityTables = {
  account: 'accounts',
  requester: 'requesters',
  evidence: 'evidence_items',
  request: 'requests',
  decision: 'decisions',
  roadmapItem: 'roadmap_items',
  release: 'releases',
} as const

export const customFieldEntityTypes = ['account', 'requester', 'evidence', 'request', 'decision', 'roadmapItem', 'release'] as const
export type CustomFieldEntityType = keyof typeof customFieldEntityTables
export type CustomFieldType = 'text' | 'number' | 'boolean' | 'date'

export function canonicalCustomFieldEntityType(value: string): CustomFieldEntityType | null {
  if (value === 'roadmap') return 'roadmapItem'
  return Object.hasOwn(customFieldEntityTables, value) ? value as CustomFieldEntityType : null
}

export function customFieldEntityTypeAliases(value: CustomFieldEntityType): [string, string] {
  return value === 'roadmapItem' ? ['roadmapItem', 'roadmap'] : [value, value]
}

export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day >= 1 && day <= days[month - 1]!
}

export function isCustomFieldValue(type: CustomFieldType, value: unknown): boolean {
  if (value === null) return true
  if (type === 'text') return typeof value === 'string' && value.length <= 20_000
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (type === 'boolean') return typeof value === 'boolean'
  return type === 'date' && typeof value === 'string' && isCalendarDate(value)
}

export async function customFieldEntityExists(db: D1Database, entityType: CustomFieldEntityType, entityId: string): Promise<boolean> {
  const table = customFieldEntityTables[entityType]
  return Boolean(await db.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(entityId).first())
}
