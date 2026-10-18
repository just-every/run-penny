CREATE TABLE penny_priority_views (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES operators(id),
 name TEXT NOT NULL CHECK(length(trim(name))>0),
 shared INTEGER NOT NULL CHECK(shared IN(0,1)),
 definition_json TEXT NOT NULL CHECK(json_valid(definition_json)),
 revision INTEGER NOT NULL CHECK(revision>0),
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE INDEX penny_priority_views_owner ON penny_priority_views(owner_id,shared);
