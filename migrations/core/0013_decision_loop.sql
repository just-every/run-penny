-- Expand the evidence and commitment model without changing historical migrations.
ALTER TABLE evidence_items ADD COLUMN named_speaker TEXT;
ALTER TABLE request_evidence_links ADD COLUMN stance TEXT NOT NULL DEFAULT 'supporting' CHECK(stance IN ('supporting','contradicting'));
ALTER TABLE roadmap_items ADD COLUMN account_impact TEXT;
ALTER TABLE roadmap_items ADD COLUMN public_title_draft TEXT;
ALTER TABLE roadmap_items ADD COLUMN public_summary_draft TEXT;
ALTER TABLE roadmap_transitions ADD COLUMN action_key TEXT;
CREATE UNIQUE INDEX roadmap_transition_action_key ON roadmap_transitions(action_key) WHERE action_key IS NOT NULL;
CREATE TABLE decision_bet_snapshots (
 id TEXT PRIMARY KEY NOT NULL, decision_revision_id TEXT NOT NULL REFERENCES decision_revisions(id),
 candidate_bet_id TEXT NOT NULL REFERENCES candidate_bets(id), disposition TEXT NOT NULL CHECK(disposition IN ('selected','declined')),
 title TEXT NOT NULL, summary TEXT NOT NULL, urgency TEXT, delivery_shape TEXT, success_measure TEXT,
 affected_requester_count INTEGER NOT NULL, affected_account_count INTEGER NOT NULL,
 supporting_count INTEGER NOT NULL, latest_support_at TEXT, contradicting_count INTEGER NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(decision_revision_id,candidate_bet_id)
);
-- The original table's unique request is the active slot. Keep the full previous
-- mapping before reusing that slot after withdrawal; historical rows are never lost.
CREATE TABLE roadmap_mapping_history (
 id TEXT PRIMARY KEY NOT NULL, roadmap_item_id TEXT NOT NULL REFERENCES roadmap_items(id),
 request_id TEXT NOT NULL REFERENCES requests(id), approved_at TEXT, withdrawn_at TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TRIGGER data_guard_decision_bet_snapshots_insert BEFORE INSERT ON decision_bet_snapshots
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_decision_bet_snapshots_update BEFORE UPDATE ON decision_bet_snapshots
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_decision_bet_snapshots_delete BEFORE DELETE ON decision_bet_snapshots
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_roadmap_mapping_history_insert BEFORE INSERT ON roadmap_mapping_history
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_roadmap_mapping_history_update BEFORE UPDATE ON roadmap_mapping_history
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_roadmap_mapping_history_delete BEFORE DELETE ON roadmap_mapping_history
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
ALTER TABLE roadmap_publications ADD COLUMN public_slug TEXT;
UPDATE roadmap_publications SET public_slug='roadmap-'||lower(hex(randomblob(16)));
CREATE UNIQUE INDEX roadmap_publication_public_slug ON roadmap_publications(public_slug);
CREATE TRIGGER roadmap_publication_identity AFTER INSERT ON roadmap_publications WHEN NEW.public_slug IS NULL
BEGIN UPDATE roadmap_publications SET public_slug='roadmap-'||lower(hex(randomblob(16))) WHERE id=NEW.id; END;
ALTER TABLE roadmap_publications ADD COLUMN board_id TEXT REFERENCES boards(id);
ALTER TABLE decision_revisions ADD COLUMN owner_operator_id TEXT REFERENCES operators(id);
-- Earlier stores may contain multiple historical items for one bet. Preserve
-- those rows, while refusing new duplicate associations outside archive restore.
CREATE INDEX roadmap_item_candidate_bet ON roadmap_items(candidate_bet_id);
CREATE TRIGGER roadmap_item_bet_unique_insert BEFORE INSERT ON roadmap_items
WHEN (SELECT phase FROM data_state WHERE singleton=1)!='applying' AND NEW.candidate_bet_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM roadmap_items WHERE candidate_bet_id=NEW.candidate_bet_id)
 AND NOT EXISTS(SELECT 1 FROM roadmap_items WHERE id=NEW.id AND candidate_bet_id=NEW.candidate_bet_id)
BEGIN SELECT RAISE(ABORT,'Bet already has a roadmap item'); END;
CREATE TRIGGER roadmap_item_bet_unique_update BEFORE UPDATE OF candidate_bet_id ON roadmap_items
WHEN (SELECT phase FROM data_state WHERE singleton=1)!='applying' AND NEW.candidate_bet_id IS NOT OLD.candidate_bet_id
 AND NEW.candidate_bet_id IS NOT NULL AND EXISTS(SELECT 1 FROM roadmap_items WHERE candidate_bet_id=NEW.candidate_bet_id AND id!=NEW.id)
BEGIN SELECT RAISE(ABORT,'Bet already has a roadmap item'); END;
-- Serialized write guards make races resolve before or after the whole commitment.
CREATE TRIGGER decision_commit_validate BEFORE INSERT ON decision_revisions
WHEN NEW.revision_number=1 AND (SELECT state FROM decisions WHERE id=NEW.decision_id) IN ('draft','ready')
BEGIN
 SELECT RAISE(ABORT,'Multiple historical roadmap items require resolution') WHERE (SELECT COUNT(*) FROM roadmap_items WHERE candidate_bet_id=NEW.selected_candidate_bet_id)>1;
 SELECT RAISE(ABORT,'Question required') WHERE trim((SELECT question FROM decisions WHERE id=NEW.decision_id),char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))='';
 SELECT RAISE(ABORT,'Owner required') WHERE NEW.owner_operator_id IS NULL;
 SELECT RAISE(ABORT,'Selected bet mismatch') WHERE NOT EXISTS(SELECT 1 FROM candidate_bets WHERE id=NEW.selected_candidate_bet_id AND decision_id=NEW.decision_id);
 SELECT RAISE(ABORT,'Linked evidence required') WHERE NOT EXISTS(SELECT 1 FROM candidate_bets b JOIN candidate_bet_evidence_links l ON l.candidate_bet_id=b.id WHERE b.decision_id=NEW.decision_id);
 SELECT RAISE(ABORT,'No viable alternative reason required') WHERE (SELECT COUNT(*) FROM candidate_bets WHERE decision_id=NEW.decision_id)<2 AND COALESCE(trim(NEW.no_viable_alternative_reason),'')='';
END;
CREATE TRIGGER decision_editor_serialized BEFORE INSERT ON audit_entries
WHEN (SELECT phase FROM data_state WHERE singleton=1)!='applying' AND NEW.entity_type='decision' AND NEW.action IN ('bet.added','bet.edited','decision.edited') AND (SELECT state FROM decisions WHERE id=NEW.entity_id) NOT IN ('draft','ready')
BEGIN SELECT RAISE(ABORT,'Decision already committed'); END;
-- Status updates capture the publication at each recorded transition.
CREATE TABLE roadmap_update_versions (
 id TEXT PRIMARY KEY, transition_id TEXT NOT NULL UNIQUE REFERENCES roadmap_transitions(id),
 roadmap_item_id TEXT NOT NULL REFERENCES roadmap_items(id), author_operator_id TEXT NOT NULL REFERENCES operators(id),
 version_number INTEGER NOT NULL, public_status TEXT NOT NULL CHECK(public_status IN('under_review','planned','in_progress','shipped','withdrawn')),
 title TEXT NOT NULL, problem TEXT NOT NULL, body TEXT NOT NULL, public_slug TEXT NOT NULL,
 approval_id TEXT NOT NULL, approval_at TEXT NOT NULL, approval_updated_at TEXT NOT NULL,
 published_at TEXT, publication_claim TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(roadmap_item_id,version_number)
);
CREATE TABLE roadmap_update_targets (
 version_id TEXT NOT NULL REFERENCES roadmap_update_versions(id), request_id TEXT NOT NULL REFERENCES requests(id),
 approval_at TEXT NOT NULL, approval_updated_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(version_id,request_id)
);
CREATE TRIGGER data_guard_roadmap_update_versions_insert BEFORE INSERT ON roadmap_update_versions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_roadmap_update_versions_update BEFORE UPDATE ON roadmap_update_versions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_roadmap_update_versions_delete BEFORE DELETE ON roadmap_update_versions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_roadmap_update_targets_insert BEFORE INSERT ON roadmap_update_targets
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_roadmap_update_targets_update BEFORE UPDATE ON roadmap_update_targets
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_roadmap_update_targets_delete BEFORE DELETE ON roadmap_update_targets
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER roadmap_move_changed BEFORE INSERT ON roadmap_transitions
WHEN NEW.action_key IS NOT NULL AND NEW.from_status=NEW.to_status
BEGIN SELECT RAISE(ABORT,'Choose a different status'); END;
CREATE TRIGGER roadmap_approve_validate_insert BEFORE INSERT ON roadmap_publications
WHEN (SELECT phase FROM data_state WHERE singleton=1)!='applying' AND NEW.board_id IS NOT NULL
BEGIN
 SELECT RAISE(ABORT,'public board required') WHERE NOT EXISTS(SELECT 1 FROM boards WHERE id=NEW.board_id AND visibility='public' AND archived_at IS NULL);
 SELECT RAISE(ABORT,'Dropped item cannot be approved') WHERE (SELECT status FROM roadmap_items WHERE id=NEW.roadmap_item_id)='dropped';
END;
CREATE TRIGGER roadmap_approve_validate_update BEFORE UPDATE OF approved_at,board_id ON roadmap_publications
WHEN (SELECT phase FROM data_state WHERE singleton=1)!='applying' AND NEW.board_id IS NOT NULL AND NEW.withdrawn_at IS NULL
BEGIN
 SELECT RAISE(ABORT,'public board required') WHERE NOT EXISTS(SELECT 1 FROM boards WHERE id=NEW.board_id AND visibility='public' AND archived_at IS NULL);
 SELECT RAISE(ABORT,'Dropped item cannot be approved') WHERE (SELECT status FROM roadmap_items WHERE id=NEW.roadmap_item_id)='dropped';
END;
CREATE TRIGGER roadmap_mapping_validate BEFORE INSERT ON roadmap_request_mappings
WHEN (SELECT phase FROM data_state WHERE singleton=1)!='applying' AND NEW.approved_at IS NOT NULL AND NEW.withdrawn_at IS NULL
BEGIN
 SELECT RAISE(ABORT,'published request required') WHERE NOT EXISTS(SELECT 1 FROM requests r JOIN boards b ON b.id=r.board_id LEFT JOIN requesters a ON a.id=r.author_requester_id WHERE r.id=NEW.request_id AND r.moderation_state='approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL AND b.visibility='public' AND (a.id IS NULL OR a.blocked_at IS NULL));
END;
CREATE TABLE roadmap_evidence_links (
 roadmap_item_id TEXT NOT NULL REFERENCES roadmap_items(id), evidence_id TEXT NOT NULL REFERENCES evidence_items(id),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(roadmap_item_id,evidence_id)
);
CREATE TRIGGER data_guard_roadmap_evidence_links_insert BEFORE INSERT ON roadmap_evidence_links WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_roadmap_evidence_links_update BEFORE UPDATE ON roadmap_evidence_links WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_roadmap_evidence_links_delete BEFORE DELETE ON roadmap_evidence_links WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
ALTER TABLE decision_revisions ADD COLUMN roadmap_item_id TEXT REFERENCES roadmap_items(id);
