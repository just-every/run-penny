import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}

export const operators = sqliteTable('operators', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  ...timestamps,
})

export const operatorSessions = sqliteTable(
  'operator_sessions',
  {
    id: text('id').primaryKey(),
    operatorId: text('operator_id').notNull().references(() => operators.id),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: text('expires_at').notNull(),
    lastUsedAt: text('last_used_at').notNull(),
    revokedAt: text('revoked_at'),
    ...timestamps,
  },
  (table) => [index('operator_sessions_operator_id_idx').on(table.operatorId)],
)

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  internalOwnerId: text('internal_owner_id').references(() => operators.id),
  revenueCents: integer('revenue_cents'),
  renewalDate: text('renewal_date'),
  health: text('health'),
  ...timestamps,
})

export const requesters = sqliteTable('requesters', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  blockedAt: text('blocked_at'),
  ...timestamps,
})

export const requesterAddresses = sqliteTable(
  'requester_addresses',
  {
    id: text('id').primaryKey(),
    requesterId: text('requester_id').notNull().references(() => requesters.id),
    email: text('email').notNull().unique(),
    verifiedAt: text('verified_at'),
    suppressedAt: text('suppressed_at'),
    ...timestamps,
  },
  (table) => [index('requester_addresses_requester_id_idx').on(table.requesterId)],
)

export const requesterAccountLinks = sqliteTable(
  'requester_account_links',
  {
    requesterId: text('requester_id').notNull().references(() => requesters.id),
    accountId: text('account_id').notNull().references(() => accounts.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.requesterId, table.accountId] })],
)

export const boards = sqliteTable('boards', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  visibility: text('visibility', { enum: ['public', 'internal'] }).notNull(),
  position: integer('position').notNull(),
  archivedAt: text('archived_at'),
  ...timestamps,
})

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  ...timestamps,
})

export const evidenceItems = sqliteTable(
  'evidence_items',
  {
    id: text('id').primaryKey(),
    sourceType: text('source_type').notNull(),
    sourceLabel: text('source_label'),
    namedSpeaker: text('named_speaker'),
    accountId: text('account_id').references(() => accounts.id),
    requesterId: text('requester_id').references(() => requesters.id),
    recordedByOperatorId: text('recorded_by_operator_id').references(() => operators.id),
    observedAt: text('observed_at').notNull(),
    reviewState: text('review_state', { enum: ['unreviewed', 'reviewed'] }).notNull(),
    reviewReason: text('review_reason'),
    ...timestamps,
  },
  (table) => [
    index('evidence_items_account_observed_idx').on(table.accountId, table.observedAt),
    index('evidence_items_review_state_idx').on(table.reviewState),
  ],
)

export const evidenceVersions = sqliteTable(
  'evidence_versions',
  {
    id: text('id').primaryKey(),
    evidenceId: text('evidence_id').notNull().references(() => evidenceItems.id),
    versionNumber: integer('version_number').notNull(),
    wording: text('wording').notNull(),
    editedByOperatorId: text('edited_by_operator_id').references(() => operators.id),
    ...timestamps,
  },
  (table) => [uniqueIndex('evidence_versions_evidence_id_version_number').on(table.evidenceId, table.versionNumber)],
)

export const evidenceTagAssignments = sqliteTable(
  'evidence_tag_assignments',
  {
    evidenceId: text('evidence_id').notNull().references(() => evidenceItems.id),
    tagId: text('tag_id').notNull().references(() => tags.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.evidenceId, table.tagId] })],
)

export const requests = sqliteTable(
  'requests',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    boardId: text('board_id').notNull().references(() => boards.id),
    authorRequesterId: text('author_requester_id').references(() => requesters.id),
    title: text('title').notNull(),
    description: text('description').notNull(),
    proposedSolution: text('proposed_solution'),
    impactStatement: text('impact_statement'),
    moderationState: text('moderation_state', { enum: ['awaiting_review', 'approved', 'rejected'] }).notNull(),
    publicState: text('public_state', {
      enum: ['unpublished', 'open', 'under_review', 'planned', 'in_progress', 'shipped', 'declined', 'withdrawn'],
    }).notNull(),
    publicTitle: text('public_title'),
    publicDescription: text('public_description'),
    publishedAt: text('published_at'),
    declinedReason: text('declined_reason'),
    withdrawnAt: text('withdrawn_at'),
    ...timestamps,
  },
  (table) => [index('requests_board_public_state_idx').on(table.boardId, table.publicState)],
)

export const requestEvidenceLinks = sqliteTable(
  'request_evidence_links',
  {
    requestId: text('request_id').notNull().references(() => requests.id),
    stance: text('stance', {enum:['supporting','contradicting']}).notNull().default('supporting'),
    evidenceId: text('evidence_id').notNull().references(() => evidenceItems.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.requestId, table.evidenceId] })],
)

export const requestTagAssignments = sqliteTable(
  'request_tag_assignments',
  {
    requestId: text('request_id').notNull().references(() => requests.id),
    tagId: text('tag_id').notNull().references(() => tags.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.requestId, table.tagId] })],
)

export const requestVotes = sqliteTable(
  'request_votes',
  {
    requestId: text('request_id').notNull().references(() => requests.id),
    requesterId: text('requester_id').notNull().references(() => requesters.id),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.requestId, table.requesterId] })],
)

export const requestComments = sqliteTable('request_comments', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull().references(() => requests.id),
  requesterId: text('requester_id').references(() => requesters.id),
  operatorId: text('operator_id').references(() => operators.id),
  body: text('body').notNull(),
  moderationState: text('moderation_state', { enum: ['awaiting_review', 'approved', 'rejected'] }).notNull(),
  publishedAt: text('published_at'),
  ...timestamps,
})

export const requestFollows = sqliteTable(
  'request_follows',
  {
    requestId: text('request_id').notNull().references(() => requests.id),
    requesterId: text('requester_id').notNull().references(() => requesters.id),
    permissionGrantedAt: text('permission_granted_at').notNull(),
    mutedAt: text('muted_at'),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.requestId, table.requesterId] })],
)

export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  requestId: text('request_id').references(() => requests.id),
  evidenceId: text('evidence_id').references(() => evidenceItems.id),
  storageKey: text('storage_key').notNull().unique(),
  originalFilename: text('original_filename').notNull(),
  contentType: text('content_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  publicState: text('public_state', { enum: ['operator_only', 'published', 'rejected'] }).notNull(),
  rejectionReason: text('rejection_reason'),
  ...timestamps,
})

export const decisions = sqliteTable(
  'decisions',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    question: text('question').notNull(),
    state: text('state', { enum: ['draft', 'ready', 'committed', 'review_due'] }).notNull(),
    ownerOperatorId: text('owner_operator_id').references(() => operators.id),
    confidence: text('confidence', { enum: ['low', 'medium', 'high'] }),
    reviewAt: text('review_at'),
    selectedCandidateBetId: text('selected_candidate_bet_id'),
    rationale: text('rationale'),
    ...timestamps,
  },
  (table) => [index('decisions_state_review_at_idx').on(table.state, table.reviewAt)],
)

export const candidateBets = sqliteTable(
  'candidate_bets',
  {
    id: text('id').primaryKey(),
    decisionId: text('decision_id').notNull().references(() => decisions.id),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    urgency: text('urgency'),
    deliveryShape: text('delivery_shape'),
    successMeasure: text('success_measure'),
    assumptions: text('assumptions'),
    counterEvidence: text('counter_evidence'),
    ...timestamps,
  },
  (table) => [index('candidate_bets_decision_id_idx').on(table.decisionId)],
)

export const candidateBetAccountLinks = sqliteTable(
  'candidate_bet_account_links',
  {
    candidateBetId: text('candidate_bet_id').notNull().references(() => candidateBets.id),
    accountId: text('account_id').notNull().references(() => accounts.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.candidateBetId, table.accountId] })],
)

export const candidateBetEvidenceLinks = sqliteTable(
  'candidate_bet_evidence_links',
  {
    candidateBetId: text('candidate_bet_id').notNull().references(() => candidateBets.id),
    evidenceId: text('evidence_id').notNull().references(() => evidenceItems.id),
    stance: text('stance', { enum: ['supporting', 'contradicting'] }).notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.candidateBetId, table.evidenceId] })],
)

export const decisionRevisions = sqliteTable(
  'decision_revisions',
  {
    id: text('id').primaryKey(),
    decisionId: text('decision_id').notNull().references(() => decisions.id),
    ownerOperatorId: text('owner_operator_id').references(()=>operators.id),
    roadmapItemId:text('roadmap_item_id').references(()=>roadmapItems.id),
    revisionNumber: integer('revision_number').notNull(),
    selectedCandidateBetId: text('selected_candidate_bet_id').references(() => candidateBets.id),
    rationale: text('rationale').notNull(),
    confidence: text('confidence', { enum: ['low', 'medium', 'high'] }).notNull(),
    reviewAt: text('review_at').notNull(),
    noViableAlternativeReason: text('no_viable_alternative_reason'),
    committedByOperatorId: text('committed_by_operator_id').notNull().references(() => operators.id),
    ...timestamps,
  },
  (table) => [uniqueIndex('decision_revisions_decision_id_revision_number').on(table.decisionId, table.revisionNumber)],
)

export const decisionEvidenceSnapshots = sqliteTable('decision_evidence_snapshots', {
  id: text('id').primaryKey(),
  decisionRevisionId: text('decision_revision_id').notNull().references(() => decisionRevisions.id),
  evidenceId: text('evidence_id').notNull().references(() => evidenceItems.id),
  evidenceVersionId: text('evidence_version_id').notNull().references(() => evidenceVersions.id),
  candidateBetId: text('candidate_bet_id').notNull().references(() => candidateBets.id),
  stance: text('stance', { enum: ['supporting', 'contradicting'] }).notNull(),
  ...timestamps,
})

export const roadmapItems = sqliteTable(
  'roadmap_items',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    decisionId: text('decision_id').references(() => decisions.id),
    candidateBetId: text('candidate_bet_id').unique().references(() => candidateBets.id),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    ownerOperatorId: text('owner_operator_id').references(() => operators.id),
    status: text('status', { enum: ['exploring', 'planned', 'in_progress', 'shipped', 'dropped'] }).notNull(),
    accountImpact:text('account_impact'),
    publicTitleDraft:text('public_title_draft'),
    publicSummaryDraft:text('public_summary_draft'),
    targetWindow: text('target_window'),
    deliveryNotes: text('delivery_notes'),
    confidence: text('confidence', { enum: ['low', 'medium', 'high'] }),
    ...timestamps,
  },
  (table) => [index('roadmap_items_status_idx').on(table.status)],
)

export const roadmapTransitions = sqliteTable('roadmap_transitions', {
  id: text('id').primaryKey(),
  roadmapItemId: text('roadmap_item_id').notNull().references(() => roadmapItems.id),
  actionKey:text('action_key').unique(),
  fromStatus: text('from_status'),
  toStatus: text('to_status', { enum: ['exploring', 'planned', 'in_progress', 'shipped', 'dropped'] }).notNull(),
  reason: text('reason').notNull(),
  actorOperatorId: text('actor_operator_id').notNull().references(() => operators.id),
  ...timestamps,
})

export const roadmapPublications = sqliteTable('roadmap_publications', {
  id: text('id').primaryKey(),
  roadmapItemId: text('roadmap_item_id').notNull().unique().references(() => roadmapItems.id),
  publicSlug:text('public_slug').unique(),
  boardId:text('board_id').references(()=>boards.id),
  publicTitle: text('public_title').notNull(),
  publicSummary: text('public_summary').notNull(),
  approvedByOperatorId: text('approved_by_operator_id').notNull().references(() => operators.id),
  approvedAt: text('approved_at').notNull(),
  withdrawnAt: text('withdrawn_at'),
  ...timestamps,
})

export const roadmapRequestMappings = sqliteTable(
  'roadmap_request_mappings',
  {
    roadmapItemId: text('roadmap_item_id').notNull().references(() => roadmapItems.id),
    requestId: text('request_id').notNull().unique().references(() => requests.id),
    approvedAt: text('approved_at'),
    withdrawnAt: text('withdrawn_at'),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.roadmapItemId, table.requestId] })],
)

export const releases = sqliteTable('releases', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  state: text('state', { enum: ['draft', 'published'] }).notNull(),
  currentVersionId: text('current_version_id'),
  authorOperatorId: text('author_operator_id').notNull().references(() => operators.id),
  publishedAt: text('published_at'),
  ...timestamps,
})

export const releaseVersions = sqliteTable(
  'release_versions',
  {
    id: text('id').primaryKey(),
    releaseId: text('release_id').notNull().references(() => releases.id),
    versionNumber: integer('version_number').notNull(),
    title: text('title').notNull(),
    releaseType: text('release_type', { enum: ['new', 'improved', 'fixed'] }).notNull(),
    body: text('body').notNull(),
    publicationDate: text('publication_date'),
    setupUrl: text('setup_url'),
    outcomePrompt: text('outcome_prompt').notNull(),
    subjectTagsJson: text('subject_tags_json').notNull(),
    publicationClaim: text('publication_claim'),
    authorName: text('author_name'),
    tagNamesJson: text('tag_names_json'),
    isPortalCurrent: integer('is_portal_current', { mode: 'boolean' }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('release_versions_release_id_version_number').on(table.releaseId, table.versionNumber)],
)

export const releaseTargets = sqliteTable(
  'release_targets',
  {
    releaseId: text('release_id').notNull().references(() => releases.id),
    roadmapItemId: text('roadmap_item_id').notNull().references(() => roadmapItems.id),
    decisionId: text('decision_id').notNull().references(() => decisions.id),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.releaseId, table.roadmapItemId] })],
)

export const releaseRecipientSnapshots = sqliteTable(
  'release_recipient_snapshots',
  {
    id: text('id').primaryKey(),
    releaseVersionId: text('release_version_id').notNull().references(() => releaseVersions.id),
    requesterId: text('requester_id').notNull().references(() => requesters.id),
    requesterAddressId: text('requester_address_id').notNull().references(() => requesterAddresses.id),
    requestId: text('request_id').references(() => requests.id),
    evidenceId: text('evidence_id').references(() => evidenceItems.id),
    recipientEmail: text('recipient_email'),
    verificationEpoch: integer('verification_epoch'),
    ...timestamps,
  },
  (table) => [uniqueIndex('release_recipient_snapshots_release_version_id_requester_id').on(table.releaseVersionId, table.requesterId)],
)

export const releaseOutcomes = sqliteTable(
  'release_outcomes',
  {
    id: text('id').primaryKey(),
    releaseVersionId: text('release_version_id').notNull().references(() => releaseVersions.id),
    requesterId: text('requester_id').notNull().references(() => requesters.id),
    roadmapItemId: text('roadmap_item_id').notNull().references(() => roadmapItems.id),
    outcome: text('outcome', { enum: ['adopted', 'partly_adopted', 'not_yet'] }).notNull(),
    revisionNumber: integer('revision_number').notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('release_outcomes_version_requester_item_revision').on(table.releaseVersionId, table.requesterId, table.roadmapItemId, table.revisionNumber)],
)

export const customFieldDefinitions = sqliteTable('custom_field_definitions', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  name: text('name').notNull(),
  fieldType: text('field_type').notNull(),
  ...timestamps,
}, (table) => [uniqueIndex('custom_field_definitions_entity_type_name').on(table.entityType, table.name)])

export const customFieldValues = sqliteTable('custom_field_values', {
  id: text('id').primaryKey(),
  definitionId: text('definition_id').notNull().references(() => customFieldDefinitions.id),
  entityId: text('entity_id').notNull(),
  valueJson: text('value_json').notNull(),
  ...timestamps,
}, (table) => [uniqueIndex('custom_field_values_definition_id_entity_id').on(table.definitionId, table.entityId)])

export const auditEntries = sqliteTable(
  'audit_entries',
  {
    id: text('id').primaryKey(),
    actorType: text('actor_type', { enum: ['operator', 'system'] }).notNull(),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    occurredAt: text('occurred_at').notNull(),
    detailsJson: text('details_json'),
    ...timestamps,
  },
  (table) => [index('audit_entries_entity_idx').on(table.entityType, table.entityId, table.occurredAt)],
)

export {decisionBetSnapshots,roadmapMappingHistory,roadmapEvidenceLinks,roadmapUpdateVersions,roadmapUpdateTargets} from './decision-loop-schema'
