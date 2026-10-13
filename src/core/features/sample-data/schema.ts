import { z } from 'zod'

const id = z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/)
const optionalText = z.string().min(1).nullable()
const timestamp = z.string().min(1)
const confidence = z.enum(['low', 'medium', 'high'])

const operatorSchema = z.object({
  id,
  email: z.string().email(),
  displayName: z.string().min(1),
})

const accountSchema = z.object({
  id,
  slug: z.string().min(1),
  name: z.string().min(1),
  internalOwnerId: id,
  revenueCents: z.number().int().nonnegative().nullable(),
  renewalDate: optionalText,
  health: optionalText,
})

const requesterSchema = z.object({
  id,
  displayName: z.string().min(1),
  addressId: id,
  email: z.string().email(),
  accountId: id,
})

const evidenceSchema = z.object({
  id,
  versionId: id,
  sourceType: z.enum(['portal_request', 'sales_call', 'support_conversation', 'interview', 'email', 'free_text']),
  sourceLabel: optionalText,
  accountId: id.nullable(),
  requesterId: id.nullable(),
  recordedByOperatorId: id.nullable(),
  observedAt: timestamp,
  reviewState: z.enum(['unreviewed', 'reviewed']),
  reviewReason: optionalText,
  wording: z.string().min(1),
  tagIds: z.array(id),
})

const requestCommentSchema = z.object({
  id,
  requesterId: id.nullable(),
  operatorId: id.nullable(),
  body: z.string().min(1),
  moderationState: z.enum(['awaiting_review', 'approved', 'rejected']),
  publishedAt: timestamp.nullable(),
}).superRefine((comment, context) => {
  if ((comment.requesterId === null) === (comment.operatorId === null)) {
    context.addIssue({ code: 'custom', message: 'A comment has exactly one author.' })
  }
})

const requestSchema = z.object({
  id,
  slug: z.string().min(1),
  boardId: id,
  authorRequesterId: id.nullable(),
  title: z.string().min(1),
  description: z.string().min(1),
  proposedSolution: optionalText,
  impactStatement: optionalText,
  moderationState: z.enum(['awaiting_review', 'approved', 'rejected']),
  publicState: z.enum(['unpublished', 'open', 'under_review', 'planned', 'in_progress', 'shipped', 'declined', 'withdrawn']),
  publicTitle: optionalText,
  publicDescription: optionalText,
  publishedAt: timestamp.nullable(),
  declinedReason: optionalText,
  withdrawnAt: timestamp.nullable(),
  evidenceIds: z.array(id),
  tagIds: z.array(id),
  voterIds: z.array(id),
  followerIds: z.array(id),
  comments: z.array(requestCommentSchema),
}).superRefine((request, context) => {
  const isPublic = request.publicState !== 'unpublished' && request.publicState !== 'withdrawn'
  if (isPublic && (request.moderationState !== 'approved' || request.publicTitle === null || request.publicDescription === null || request.publishedAt === null)) {
    context.addIssue({ code: 'custom', message: 'A public request must have approved public content.' })
  }
})

const candidateBetSchema = z.object({
  id,
  title: z.string().min(1),
  summary: z.string().min(1),
  urgency: optionalText,
  deliveryShape: optionalText,
  successMeasure: optionalText,
  assumptions: optionalText,
  counterEvidence: optionalText,
  accountIds: z.array(id),
  evidenceLinks: z.array(z.object({ evidenceId: id, stance: z.enum(['supporting', 'contradicting']) })),
})

const decisionSnapshotSchema = z.object({
  id,
  evidenceId: id,
  evidenceVersionId: id,
  candidateBetId: id,
  stance: z.enum(['supporting', 'contradicting']),
})

const decisionRevisionSchema = z.object({
  id,
  revisionNumber: z.number().int().positive(),
  selectedCandidateBetId: id,
  rationale: z.string().min(1),
  confidence,
  reviewAt: timestamp,
  noViableAlternativeReason: optionalText,
  committedByOperatorId: id,
  snapshots: z.array(decisionSnapshotSchema).min(1),
})

const decisionSchema = z.object({
  id,
  slug: z.string().min(1),
  title: z.string().min(1),
  question: z.string().min(1),
  state: z.enum(['draft', 'ready', 'committed', 'review_due']),
  ownerOperatorId: id.nullable(),
  confidence: confidence.nullable(),
  reviewAt: timestamp.nullable(),
  selectedCandidateBetId: id.nullable(),
  rationale: optionalText,
  bets: z.array(candidateBetSchema),
  revision: decisionRevisionSchema.nullable().default(null),
}).superRefine((decision, context) => {
  if (decision.state === 'committed' && (decision.revision === null || decision.selectedCandidateBetId === null || decision.rationale === null || decision.confidence === null || decision.reviewAt === null)) {
    context.addIssue({ code: 'custom', message: 'A committed decision needs its durable commitment.' })
  }
})

const roadmapTransitionSchema = z.object({
  id,
  fromStatus: z.enum(['exploring', 'planned', 'in_progress', 'shipped', 'dropped']).nullable(),
  toStatus: z.enum(['exploring', 'planned', 'in_progress', 'shipped', 'dropped']),
  reason: z.string().min(1),
  actorOperatorId: id,
})

const roadmapItemSchema = z.object({
  id,
  slug: z.string().min(1),
  decisionId: id.nullable(),
  candidateBetId: id.nullable(),
  title: z.string().min(1),
  summary: z.string().min(1),
  ownerOperatorId: id.nullable(),
  status: z.enum(['exploring', 'planned', 'in_progress', 'shipped', 'dropped']),
  targetWindow: optionalText,
  deliveryNotes: optionalText,
  confidence: confidence.nullable(),
  transition: roadmapTransitionSchema,
}).superRefine((item, context) => {
  if (item.status !== item.transition.toStatus) {
    context.addIssue({ code: 'custom', message: 'The roadmap transition must produce the current status.' })
  }
})

const roadmapPublicationSchema = z.object({
  id,
  roadmapItemId: id,
  publicTitle: z.string().min(1),
  publicSummary: z.string().min(1),
  approvedByOperatorId: id,
  approvedAt: timestamp,
  withdrawnAt: timestamp.nullable(),
})

const roadmapRequestMappingSchema = z.object({
  roadmapItemId: id,
  requestId: id,
  approvedAt: timestamp.nullable(),
  withdrawnAt: timestamp.nullable(),
})

const releaseVersionSchema = z.object({
  id,
  versionNumber: z.number().int().positive(),
  title: z.string().min(1),
  releaseType: z.enum(['new', 'improved', 'fixed']),
  body: z.string().min(1),
  publicationDate: timestamp.nullable(),
  setupUrl: optionalText,
  outcomePrompt: z.string().min(1),
  subjectTagIds: z.array(id),
  isPortalCurrent: z.boolean(),
})

const releaseSchema = z.object({
  id,
  slug: z.string().min(1),
  state: z.enum(['draft', 'published']),
  currentVersionId: id,
  authorOperatorId: id,
  publishedAt: timestamp.nullable(),
  version: releaseVersionSchema,
  targetRoadmapItemIds: z.array(id).min(1),
}).superRefine((release, context) => {
  if (release.currentVersionId !== release.version.id) {
    context.addIssue({ code: 'custom', message: 'The release current version must be included.' })
  }
  if (release.state === 'published' && (release.publishedAt === null || !release.version.isPortalCurrent)) {
    context.addIssue({ code: 'custom', message: 'A published release needs a current public version.' })
  }
})

export const pennySampleSchema = z.object({
  version: z.literal('penny.v1'),
  operators: z.array(operatorSchema).min(1),
  accounts: z.array(accountSchema),
  requesters: z.array(requesterSchema),
  boards: z.array(z.object({
    id,
    slug: z.string().min(1),
    name: z.string().min(1),
    visibility: z.enum(['public', 'internal']),
    position: z.number().int().nonnegative(),
  })),
  tags: z.array(z.object({ id, name: z.string().min(1) })),
  evidence: z.array(evidenceSchema),
  requests: z.array(requestSchema),
  decisions: z.array(decisionSchema),
  roadmapItems: z.array(roadmapItemSchema),
  roadmapPublications: z.array(roadmapPublicationSchema),
  roadmapRequestMappings: z.array(roadmapRequestMappingSchema),
  releases: z.array(releaseSchema),
})

export type PennySample = z.infer<typeof pennySampleSchema>
