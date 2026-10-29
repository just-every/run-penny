import { z } from 'zod'
import { publicStatuses } from './status-sql'
export const statusPublicationSchema=z.object({
 notifyCapturedContacts:z.boolean().default(false),
 status:z.enum(publicStatuses),body:z.string().trim().max(20_000).default(''),pinned:z.boolean().default(false),
 publicEta:z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2]|Q[1-4])$/,'Choose a month (YYYY-MM) or quarter (YYYY-Q1).').nullable().optional(),
 internalStatusId:z.string().min(1).max(128).nullable().optional(),
 idempotencyKey:z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/).optional(),
}).strict()
