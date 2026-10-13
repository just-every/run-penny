-- Penny request lifecycle. Requester authentication material lives in 0002_auth
-- and operator notification delivery lives in 0003_operator.

ALTER TABLE requests ADD COLUMN merged_into_request_id TEXT REFERENCES requests(id);
ALTER TABLE requests ADD COLUMN merged_at TEXT;
ALTER TABLE evidence_items ADD COLUMN withdrawn_at TEXT;
ALTER TABLE request_comments ADD COLUMN rejection_reason TEXT;
ALTER TABLE request_comments ADD COLUMN edited_at TEXT;

CREATE INDEX requests_merged_into_idx ON requests(merged_into_request_id);

CREATE TABLE request_content_submissions (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL REFERENCES requests(id),
  requester_id TEXT NOT NULL REFERENCES requesters(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  proposed_solution TEXT,
  impact_statement TEXT,
  moderation_state TEXT NOT NULL CHECK (moderation_state IN ('awaiting_review', 'approved', 'rejected')),
  rejection_reason TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX request_content_submissions_request_state_idx
  ON request_content_submissions(request_id, moderation_state, created_at DESC);

CREATE TABLE request_comment_edits (
  id TEXT PRIMARY KEY NOT NULL,
  comment_id TEXT NOT NULL REFERENCES request_comments(id),
  requester_id TEXT NOT NULL REFERENCES requesters(id),
  body TEXT NOT NULL,
  moderation_state TEXT NOT NULL CHECK (moderation_state IN ('awaiting_review', 'approved', 'rejected')),
  rejection_reason TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX request_comment_edits_comment_state_idx
  ON request_comment_edits(comment_id, moderation_state, created_at DESC);

CREATE TABLE request_moderation_events (
  id TEXT PRIMARY KEY NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('request', 'request_edit', 'comment', 'comment_edit', 'attachment')),
  subject_id TEXT NOT NULL,
  request_id TEXT NOT NULL REFERENCES requests(id),
  verdict TEXT NOT NULL CHECK (verdict IN ('approved', 'rejected')),
  reason TEXT,
  actor_operator_id TEXT NOT NULL REFERENCES operators(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX request_moderation_events_request_idx ON request_moderation_events(request_id, created_at DESC);

CREATE TABLE request_moderation_appeals (
  id TEXT PRIMARY KEY NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('request', 'request_edit', 'comment', 'comment_edit')),
  subject_id TEXT NOT NULL,
  request_id TEXT NOT NULL REFERENCES requests(id),
  requester_id TEXT NOT NULL REFERENCES requesters(id),
  body TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open', 'reviewed')),
  reviewed_by_operator_id TEXT REFERENCES operators(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX request_moderation_appeals_request_state_idx ON request_moderation_appeals(request_id, state, created_at DESC);

CREATE TABLE request_status_updates (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL REFERENCES requests(id),
  public_status TEXT NOT NULL CHECK (public_status IN ('open', 'under_review', 'planned', 'in_progress', 'shipped', 'declined')),
  previous_public_state TEXT,
  body TEXT NOT NULL,
  pinned INTEGER NOT NULL CHECK (pinned IN (0, 1)),
  operator_id TEXT NOT NULL REFERENCES operators(id),
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX request_status_updates_request_published_idx ON request_status_updates(request_id, published_at DESC);

CREATE TABLE request_notes (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL REFERENCES requests(id),
  operator_id TEXT NOT NULL REFERENCES operators(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX request_notes_request_idx ON request_notes(request_id, created_at DESC);

CREATE TABLE requester_pending_actions (
  id TEXT PRIMARY KEY NOT NULL,
  pending_token_hash TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('submission', 'vote', 'follow', 'comment')),
  payload_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  claimed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(pending_token_hash, action_type)
);

CREATE INDEX requester_pending_actions_expiry_idx ON requester_pending_actions(expires_at, claimed_at);

CREATE TABLE requester_update_permissions (
  id TEXT PRIMARY KEY NOT NULL,
  requester_id TEXT NOT NULL REFERENCES requesters(id),
  requester_address_id TEXT NOT NULL REFERENCES requester_addresses(id),
  request_id TEXT REFERENCES requests(id),
  source TEXT NOT NULL CHECK (source IN ('submission', 'vote', 'follow', 'subscription')),
  granted_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX requester_update_permissions_requester_idx ON requester_update_permissions(requester_id, requester_address_id, revoked_at, granted_at DESC);

CREATE TABLE request_merges (
  id TEXT PRIMARY KEY NOT NULL,
  source_request_id TEXT NOT NULL REFERENCES requests(id),
  target_request_id TEXT NOT NULL REFERENCES requests(id),
  actor_operator_id TEXT NOT NULL REFERENCES operators(id),
  merged_at TEXT NOT NULL,
  unmerged_at TEXT,
  unmerged_by_operator_id TEXT REFERENCES operators(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (source_request_id != target_request_id)
);

CREATE INDEX request_merges_target_active_idx ON request_merges(target_request_id, unmerged_at);
CREATE UNIQUE INDEX request_merges_active_source_idx ON request_merges(source_request_id) WHERE unmerged_at IS NULL;

CREATE TABLE request_merge_evidence_transfers (
  merge_id TEXT NOT NULL REFERENCES request_merges(id),
  evidence_id TEXT NOT NULL REFERENCES evidence_items(id),
  target_was_linked INTEGER NOT NULL CHECK (target_was_linked IN (0, 1)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (merge_id, evidence_id)
);

CREATE TABLE request_merge_vote_transfers (
  merge_id TEXT NOT NULL REFERENCES request_merges(id),
  requester_id TEXT NOT NULL REFERENCES requesters(id),
  target_had_vote INTEGER NOT NULL CHECK (target_had_vote IN (0, 1)),
  source_created_at TEXT NOT NULL,
  source_updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (merge_id, requester_id)
);

CREATE TABLE request_merge_follow_transfers (
  merge_id TEXT NOT NULL REFERENCES request_merges(id),
  requester_id TEXT NOT NULL REFERENCES requesters(id),
  target_had_follow INTEGER NOT NULL CHECK (target_had_follow IN (0, 1)),
  source_permission_granted_at TEXT NOT NULL,
  source_muted_at TEXT,
  source_created_at TEXT NOT NULL,
  source_updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (merge_id, requester_id)
);

CREATE TABLE request_merge_comment_transfers (
  merge_id TEXT NOT NULL REFERENCES request_merges(id),
  comment_id TEXT NOT NULL REFERENCES request_comments(id),
  created_at TEXT NOT NULL
);

CREATE TABLE request_merge_attachment_transfers (
  merge_id TEXT NOT NULL REFERENCES request_merges(id),
  attachment_id TEXT NOT NULL REFERENCES attachments(id),
  created_at TEXT NOT NULL
);

CREATE TABLE requester_identity_merges (
  id TEXT PRIMARY KEY NOT NULL,
  source_requester_id TEXT NOT NULL REFERENCES requesters(id),
  target_requester_id TEXT NOT NULL REFERENCES requesters(id),
  actor_operator_id TEXT NOT NULL REFERENCES operators(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (source_requester_id != target_requester_id)
);

CREATE UNIQUE INDEX requester_identity_merges_source_idx ON requester_identity_merges(source_requester_id);

-- Public attribution is an approved snapshot. Public readers never derive it
-- from a current requester or operator identity.

ALTER TABLE requests ADD COLUMN public_author_display_name TEXT;
ALTER TABLE request_comments ADD COLUMN public_author_display_name TEXT;
ALTER TABLE request_comments ADD COLUMN public_author_kind TEXT CHECK (public_author_kind IN ('requester', 'operator'));

-- Existing published records predate the snapshot columns. This one-time
-- migration preserves their then-current explicit publication attribution;
-- future publications set snapshots through moderation writes.
UPDATE requests
SET public_author_display_name = approved_author_name
WHERE moderation_state = 'approved'
  AND published_at IS NOT NULL
  AND author_requester_id IS NOT NULL;

UPDATE request_comments
SET public_author_display_name = CASE
      WHEN requester_id IS NOT NULL THEN (SELECT requester.display_name FROM requesters requester WHERE requester.id = request_comments.requester_id)
      ELSE (SELECT operator.display_name FROM operators operator WHERE operator.id = request_comments.operator_id)
    END,
    public_author_kind = CASE WHEN requester_id IS NOT NULL THEN 'requester' ELSE 'operator' END
WHERE moderation_state = 'approved'
  AND published_at IS NOT NULL;

-- A held portal action may replay only through the requester verification link
-- that was issued for it. The value is the existing one-way pending-token hash;
-- raw browser tokens and requester addresses are never persisted here.
ALTER TABLE native_magic_links ADD COLUMN pending_token_hash TEXT;

-- The first email-verification request binds the browser token to that
-- recipient for the whole 24-hour hold window. This HMAC is derived from
-- AUTH_SECRET; no plaintext address is copied into a pending-action record.
CREATE TABLE requester_pending_action_bindings (
  pending_token_hash TEXT PRIMARY KEY NOT NULL,
  verification_email_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX requester_pending_action_bindings_expires_idx
  ON requester_pending_action_bindings(expires_at);

CREATE TABLE notification_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  requester_id TEXT REFERENCES requesters(id),
  operator_id TEXT REFERENCES operators(id),
  dedupe_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  delivery_state TEXT NOT NULL CHECK (delivery_state IN ('queued', 'accepted', 'delivered', 'failed', 'suppressed', 'unknown')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL,
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX notification_outbox_delivery_idx ON notification_outbox(delivery_state, available_at);
CREATE INDEX notification_outbox_requester_idx ON notification_outbox(requester_id, created_at DESC);
CREATE INDEX notification_outbox_operator_idx ON notification_outbox(operator_id, created_at DESC);

CREATE TABLE host_identity_accounts (
  host_account_id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id),
  created_at TEXT NOT NULL
);

INSERT INTO request_content_submissions(id,request_id,requester_id,title,description,proposed_solution,impact_statement,moderation_state,rejection_reason,approved_at,created_at,updated_at)
SELECT id,id,author_requester_id,title,description,proposed_solution,impact_statement,moderation_state,
 (SELECT reason FROM native_moderation_events e WHERE e.request_id=r.id ORDER BY created_at DESC LIMIT 1),published_at,created_at,updated_at
FROM requests r WHERE author_requester_id IS NOT NULL;
INSERT INTO request_moderation_events(id,subject_type,subject_id,request_id,verdict,reason,actor_operator_id,created_at,updated_at)
SELECT id,'request',request_id,request_id,verdict,reason,actor_id,created_at,updated_at FROM native_moderation_events;

ALTER TABLE requests ADD COLUMN author_operator_id TEXT REFERENCES operators(id);
