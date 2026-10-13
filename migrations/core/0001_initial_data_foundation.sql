-- Penny core data foundation. This migration is immutable once released.
-- It holds the durable records required by the initial real data spine; feature
-- behaviour, routes, and external adapters arrive in later migrations.

CREATE TABLE operators (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE operator_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  operator_id TEXT NOT NULL REFERENCES operators(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX operator_sessions_operator_id_idx ON operator_sessions(operator_id);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  internal_owner_id TEXT REFERENCES operators(id),
  revenue_cents INTEGER,
  renewal_date TEXT,
  health TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE requesters (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  blocked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE requester_addresses (
  id TEXT PRIMARY KEY NOT NULL,
  requester_id TEXT NOT NULL REFERENCES requesters(id),
  email TEXT NOT NULL UNIQUE,
  verified_at TEXT,
  suppressed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX requester_addresses_requester_id_idx ON requester_addresses(requester_id);

CREATE TABLE requester_account_links (
  requester_id TEXT NOT NULL REFERENCES requesters(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (requester_id, account_id)
);

CREATE TABLE boards (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'internal')),
  position INTEGER NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE evidence_items (
  id TEXT PRIMARY KEY NOT NULL,
  source_type TEXT NOT NULL,
  source_label TEXT,
  account_id TEXT REFERENCES accounts(id),
  requester_id TEXT REFERENCES requesters(id),
  recorded_by_operator_id TEXT REFERENCES operators(id),
  observed_at TEXT NOT NULL,
  review_state TEXT NOT NULL CHECK (review_state IN ('unreviewed', 'reviewed')),
  review_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX evidence_items_account_observed_idx ON evidence_items(account_id, observed_at DESC);
CREATE INDEX evidence_items_review_state_idx ON evidence_items(review_state);

CREATE TABLE evidence_versions (
  id TEXT PRIMARY KEY NOT NULL,
  evidence_id TEXT NOT NULL REFERENCES evidence_items(id),
  version_number INTEGER NOT NULL,
  wording TEXT NOT NULL,
  edited_by_operator_id TEXT REFERENCES operators(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(evidence_id, version_number)
);

CREATE TABLE evidence_tag_assignments (
  evidence_id TEXT NOT NULL REFERENCES evidence_items(id),
  tag_id TEXT NOT NULL REFERENCES tags(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (evidence_id, tag_id)
);

CREATE TABLE requests (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  board_id TEXT NOT NULL REFERENCES boards(id),
  author_requester_id TEXT REFERENCES requesters(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  proposed_solution TEXT,
  impact_statement TEXT,
  moderation_state TEXT NOT NULL CHECK (moderation_state IN ('awaiting_review', 'approved', 'rejected')),
  public_state TEXT NOT NULL CHECK (public_state IN ('unpublished', 'open', 'under_review', 'planned', 'in_progress', 'shipped', 'declined', 'withdrawn')),
  public_title TEXT,
  public_description TEXT,
  published_at TEXT,
  declined_reason TEXT,
  withdrawn_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX requests_board_public_state_idx ON requests(board_id, public_state);

CREATE TABLE request_evidence_links (
  request_id TEXT NOT NULL REFERENCES requests(id),
  evidence_id TEXT NOT NULL REFERENCES evidence_items(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (request_id, evidence_id)
);

CREATE TABLE request_tag_assignments (
  request_id TEXT NOT NULL REFERENCES requests(id),
  tag_id TEXT NOT NULL REFERENCES tags(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (request_id, tag_id)
);

CREATE TABLE request_votes (
  request_id TEXT NOT NULL REFERENCES requests(id),
  requester_id TEXT NOT NULL REFERENCES requesters(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (request_id, requester_id)
);

CREATE TABLE request_comments (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL REFERENCES requests(id),
  requester_id TEXT REFERENCES requesters(id),
  operator_id TEXT REFERENCES operators(id),
  body TEXT NOT NULL,
  moderation_state TEXT NOT NULL CHECK (moderation_state IN ('awaiting_review', 'approved', 'rejected')),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((requester_id IS NOT NULL AND operator_id IS NULL) OR (requester_id IS NULL AND operator_id IS NOT NULL))
);

CREATE TABLE request_follows (
  request_id TEXT NOT NULL REFERENCES requests(id),
  requester_id TEXT NOT NULL REFERENCES requesters(id),
  permission_granted_at TEXT NOT NULL,
  muted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (request_id, requester_id)
);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT REFERENCES requests(id),
  evidence_id TEXT REFERENCES evidence_items(id),
  storage_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  public_state TEXT NOT NULL CHECK (public_state IN ('operator_only', 'published', 'rejected')),
  rejection_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((request_id IS NOT NULL AND evidence_id IS NULL) OR (request_id IS NULL AND evidence_id IS NOT NULL))
);

CREATE TABLE decisions (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('draft', 'ready', 'committed', 'review_due')),
  owner_operator_id TEXT REFERENCES operators(id),
  confidence TEXT CHECK (confidence IN ('low', 'medium', 'high')),
  review_at TEXT,
  selected_candidate_bet_id TEXT,
  rationale TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX decisions_state_review_at_idx ON decisions(state, review_at);

CREATE TABLE candidate_bets (
  id TEXT PRIMARY KEY NOT NULL,
  decision_id TEXT NOT NULL REFERENCES decisions(id),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  urgency TEXT,
  delivery_shape TEXT,
  success_measure TEXT,
  assumptions TEXT,
  counter_evidence TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX candidate_bets_decision_id_idx ON candidate_bets(decision_id);

CREATE TABLE candidate_bet_account_links (
  candidate_bet_id TEXT NOT NULL REFERENCES candidate_bets(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (candidate_bet_id, account_id)
);

CREATE TABLE candidate_bet_evidence_links (
  candidate_bet_id TEXT NOT NULL REFERENCES candidate_bets(id),
  evidence_id TEXT NOT NULL REFERENCES evidence_items(id),
  stance TEXT NOT NULL CHECK (stance IN ('supporting', 'contradicting')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (candidate_bet_id, evidence_id)
);

CREATE TABLE decision_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  decision_id TEXT NOT NULL REFERENCES decisions(id),
  revision_number INTEGER NOT NULL,
  selected_candidate_bet_id TEXT REFERENCES candidate_bets(id),
  rationale TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  review_at TEXT NOT NULL,
  no_viable_alternative_reason TEXT,
  committed_by_operator_id TEXT NOT NULL REFERENCES operators(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(decision_id, revision_number)
);

CREATE TABLE decision_evidence_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  decision_revision_id TEXT NOT NULL REFERENCES decision_revisions(id),
  evidence_id TEXT NOT NULL REFERENCES evidence_items(id),
  evidence_version_id TEXT NOT NULL REFERENCES evidence_versions(id),
  candidate_bet_id TEXT NOT NULL REFERENCES candidate_bets(id),
  stance TEXT NOT NULL CHECK (stance IN ('supporting', 'contradicting')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE roadmap_items (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  decision_id TEXT REFERENCES decisions(id),
  candidate_bet_id TEXT REFERENCES candidate_bets(id),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  owner_operator_id TEXT REFERENCES operators(id),
  status TEXT NOT NULL CHECK (status IN ('exploring', 'planned', 'in_progress', 'shipped', 'dropped')),
  target_window TEXT,
  delivery_notes TEXT,
  confidence TEXT CHECK (confidence IN ('low', 'medium', 'high')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX roadmap_items_status_idx ON roadmap_items(status);

CREATE TABLE roadmap_transitions (
  id TEXT PRIMARY KEY NOT NULL,
  roadmap_item_id TEXT NOT NULL REFERENCES roadmap_items(id),
  from_status TEXT,
  to_status TEXT NOT NULL CHECK (to_status IN ('exploring', 'planned', 'in_progress', 'shipped', 'dropped')),
  reason TEXT NOT NULL,
  actor_operator_id TEXT NOT NULL REFERENCES operators(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE roadmap_publications (
  id TEXT PRIMARY KEY NOT NULL,
  roadmap_item_id TEXT NOT NULL UNIQUE REFERENCES roadmap_items(id),
  public_title TEXT NOT NULL,
  public_summary TEXT NOT NULL,
  approved_by_operator_id TEXT NOT NULL REFERENCES operators(id),
  approved_at TEXT NOT NULL,
  withdrawn_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE roadmap_request_mappings (
  roadmap_item_id TEXT NOT NULL REFERENCES roadmap_items(id),
  request_id TEXT NOT NULL UNIQUE REFERENCES requests(id),
  approved_at TEXT,
  withdrawn_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (roadmap_item_id, request_id)
);

CREATE TABLE releases (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('draft', 'published')),
  current_version_id TEXT,
  author_operator_id TEXT NOT NULL REFERENCES operators(id),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE release_versions (
  id TEXT PRIMARY KEY NOT NULL,
  release_id TEXT NOT NULL REFERENCES releases(id),
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  release_type TEXT NOT NULL CHECK (release_type IN ('new', 'improved', 'fixed')),
  body TEXT NOT NULL,
  publication_date TEXT,
  setup_url TEXT,
  outcome_prompt TEXT NOT NULL,
  subject_tags_json TEXT NOT NULL,
  is_portal_current INTEGER NOT NULL CHECK (is_portal_current IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(release_id, version_number)
);

CREATE TABLE release_targets (
  release_id TEXT NOT NULL REFERENCES releases(id),
  roadmap_item_id TEXT NOT NULL REFERENCES roadmap_items(id),
  decision_id TEXT NOT NULL REFERENCES decisions(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (release_id, roadmap_item_id)
);

CREATE TABLE release_recipient_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  release_version_id TEXT NOT NULL REFERENCES release_versions(id),
  requester_id TEXT NOT NULL REFERENCES requesters(id),
  requester_address_id TEXT NOT NULL REFERENCES requester_addresses(id),
  request_id TEXT REFERENCES requests(id),
  evidence_id TEXT REFERENCES evidence_items(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(release_version_id, requester_id)
);

CREATE TABLE release_outcomes (
  id TEXT PRIMARY KEY NOT NULL,
  release_version_id TEXT NOT NULL REFERENCES release_versions(id),
  requester_id TEXT NOT NULL REFERENCES requesters(id),
  roadmap_item_id TEXT NOT NULL REFERENCES roadmap_items(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('adopted', 'partly_adopted', 'not_yet')),
  revision_number INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(release_version_id, requester_id, roadmap_item_id, revision_number)
);

CREATE TABLE custom_field_definitions (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_type, name)
);

CREATE TABLE custom_field_values (
  id TEXT PRIMARY KEY NOT NULL,
  definition_id TEXT NOT NULL REFERENCES custom_field_definitions(id),
  entity_id TEXT NOT NULL,
  value_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(definition_id, entity_id)
);

CREATE TABLE audit_entries (
  id TEXT PRIMARY KEY NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('operator', 'system')),
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  occurred_at TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX audit_entries_entity_idx ON audit_entries(entity_type, entity_id, occurred_at DESC);
