import { NativeError } from '../auth/native-tokens'
import type { Row } from '../data/archive'
import { segmentId, segmentInput } from './input'

export function validateSegmentArchive(data: Record<string, Row[]>) {
 const operators = new Map(data.operators.map(row => [row.id, row]))
 for (const row of data.penny_segments) {
  const target = operators.get(row.internal_owner_id)
  if (!segmentId.safeParse(row.id).success || !segmentInput.safeParse({
   name: row.name, rule: { attribute: 'internalOwnerId', operator: 'equals', value: row.internal_owner_id },
  }).success || !target || String(target.email).endsWith('@erased.invalid') || !operators.has(row.created_by_operator_id)) {
   throw new NativeError('invalid_segment_archive', 400)
  }
 }
}
