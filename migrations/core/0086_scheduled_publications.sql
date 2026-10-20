-- Publication and this row's terminal state commit in the same guarded batch.
CREATE TABLE penny_publication_schedules (
 id TEXT PRIMARY KEY,
 release_id TEXT UNIQUE REFERENCES releases(id) ON DELETE CASCADE,
 roadmap_update_id TEXT UNIQUE REFERENCES roadmap_update_versions(id) ON DELETE CASCADE,
 author_operator_id TEXT NOT NULL REFERENCES operators(id),
 scheduled_by_operator_id TEXT NOT NULL REFERENCES operators(id),
 scheduled_at TEXT NOT NULL,
 time_zone TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('scheduled','published','failed','cancelled','held')),
 last_error TEXT,
 dismissed_at TEXT,
 completed_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 CHECK ((release_id IS NOT NULL) + (roadmap_update_id IS NOT NULL) = 1)
);
CREATE INDEX penny_publication_schedules_due ON penny_publication_schedules(state,scheduled_at);
