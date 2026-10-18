-- Internal delivery plans never confer publication or change customer promises.
CREATE TABLE penny_release_plans (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, release_date TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE penny_release_plan_items (
 plan_id TEXT NOT NULL REFERENCES penny_release_plans(id) ON DELETE CASCADE,
 roadmap_item_id TEXT NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
 PRIMARY KEY(plan_id,roadmap_item_id)
);
CREATE INDEX penny_release_plan_item ON penny_release_plan_items(roadmap_item_id);
CREATE TABLE penny_roadmap_dependencies (
 blocker_id TEXT NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
 dependent_id TEXT NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL,
 PRIMARY KEY(blocker_id,dependent_id), CHECK(blocker_id != dependent_id)
);
CREATE INDEX penny_roadmap_dependent ON penny_roadmap_dependencies(dependent_id);
CREATE TRIGGER penny_dependency_acyclic BEFORE INSERT ON penny_roadmap_dependencies
WHEN EXISTS (
 WITH RECURSIVE downstream(id) AS (
  SELECT dependent_id FROM penny_roadmap_dependencies WHERE blocker_id=NEW.dependent_id
  UNION SELECT d.dependent_id FROM penny_roadmap_dependencies d JOIN downstream s ON d.blocker_id=s.id
 ) SELECT 1 FROM downstream WHERE id=NEW.blocker_id
)
BEGIN SELECT RAISE(ABORT,'planning_dependency_cycle'); END;
