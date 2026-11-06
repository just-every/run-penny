-- Explicit native rejection history never rewrites an explanation or commitment.
CREATE TABLE learning_option_reviews(
 id TEXT PRIMARY KEY,
 investigation_id TEXT NOT NULL REFERENCES learning_investigations(id) ON DELETE CASCADE,
 artifact_id TEXT NOT NULL REFERENCES learning_artifacts(id) ON DELETE CASCADE,
 artifact_version INTEGER NOT NULL CHECK(artifact_version>0),
 option_id TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 4000),
 actor_id TEXT NOT NULL REFERENCES operators(id),
 created_at TEXT NOT NULL,
 UNIQUE(artifact_id,option_id)
);
CREATE INDEX learning_option_review_history ON learning_option_reviews(investigation_id,created_at,id);
CREATE TRIGGER learning_option_review_immutable BEFORE UPDATE ON learning_option_reviews
BEGIN SELECT RAISE(ABORT,'learning_option_review_immutable'); END;

CREATE TRIGGER data_guard_learning_option_reviews_insert BEFORE INSERT ON learning_option_reviews
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_learning_option_reviews_update BEFORE UPDATE ON learning_option_reviews
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_learning_option_reviews_delete BEFORE DELETE ON learning_option_reviews
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
