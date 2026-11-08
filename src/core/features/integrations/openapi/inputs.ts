import { z } from 'zod'
import { statusPublicationSchema } from '../../requests/status-schema'
import { releaseDraftSchema } from '../../releases/drafts'

export const integrationSlug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128)
const text = z.string().trim().min(1).max(20000)
export const createIntegrationRequest = z.object({
  title: z.string().trim().min(1).max(280), description: text, boardSlug: integrationSlug,
  evidenceIds: z.array(z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/)).max(100).default([]),
}).strict()
export const integrationComment = z.object({ body: text, approve: z.literal(true) }).strict()
export const integrationStatus = statusPublicationSchema.extend({
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]+$/).min(1).max(128), approve: z.literal(true),
}).strict()
export const integrationRelease = releaseDraftSchema.omit({ authorOperatorId: true })
export const integrationApproval = z.object({ approve: z.literal(true) }).strict()
