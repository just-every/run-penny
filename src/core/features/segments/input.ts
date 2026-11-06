import { z } from 'zod'

export const segmentId = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/)
export const segmentInput = z.object({
 name: z.string().trim().min(1).max(200),
 rule: z.object({
  attribute: z.literal('internalOwnerId'),
  operator: z.literal('equals'),
  value: segmentId,
 }).strict(),
}).strict()
export type SegmentInput = z.infer<typeof segmentInput>
