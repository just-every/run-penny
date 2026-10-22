CREATE TABLE penny_redaction_settings (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 kinds_json TEXT NOT NULL CHECK(json_valid(kinds_json)),
 patterns_json TEXT NOT NULL CHECK(json_valid(patterns_json)),
 revision INTEGER NOT NULL CHECK(revision>0)
);
