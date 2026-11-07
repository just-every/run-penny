import { z } from 'zod'
import { NativeError, digest } from '../auth/native-tokens'

const identifier = z.string().min(1).max(200)
const instant = z.iso.datetime({ offset: true }).transform(value => new Date(value).toISOString())
const query = z.object({
  actor: identifier.optional(),
  action: identifier.optional(),
  subject: identifier.optional(),
  subjectType: identifier.optional(),
  from: instant.optional(),
  to: instant.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).max(2048).optional(),
}).strict().refine(value => !value.from || !value.to || value.from <= value.to)

const cursorSchema = z.object({
  version: z.literal(1),
  ceiling: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  occurredAt: z.iso.datetime(),
  id: identifier,
  filter: z.string().regex(/^[a-f0-9]{64}$/),
}).strict()
export type AuditCursor = z.infer<typeof cursorSchema>
export type AuditQuery = Omit<z.infer<typeof query>, 'cursor'> & { filter: string; cursor?: AuditCursor }

export async function auditInput(url: string): Promise<AuditQuery> {
  try {
    const search = new URL(url).searchParams
    if ([...search.keys()].some(key => search.getAll(key).length !== 1)) throw new Error()
    const { cursor: encoded, ...input } = query.parse(Object.fromEntries(search))
    const { limit: _, ...filters } = input
    const filter = await digest(JSON.stringify(filters))
    const cursor = encoded ? cursorSchema.parse(JSON.parse(atob(encoded.replaceAll('-', '+').replaceAll('_', '/')))) : undefined
    if (cursor && cursor.filter !== filter) throw new Error()
    return { ...input, filter, cursor }
  } catch {
    throw new NativeError('validation_failed', 400)
  }
}

export function auditCursor(cursor: AuditCursor): string {
  return btoa(JSON.stringify(cursor)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}
