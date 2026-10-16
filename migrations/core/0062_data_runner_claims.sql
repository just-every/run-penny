-- A confirmed erasure, restore or saved import runs to completion on the server
-- (Queue, minute Cron and the Data page's own reads), not in the operator's tab.
-- One claim row per piece of work. A runner holds it until lease_until; another
-- runner takes it only after that, and every write a step makes first checks its
-- own token through data_runner_fences, so a stopped runner can never write late.
CREATE TABLE data_runner_claims (
 work_id TEXT PRIMARY KEY NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('operation','import')),
 operator_id TEXT,
 operator_version INTEGER,
 actor_id TEXT,
 runner TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0,
 steps INTEGER NOT NULL DEFAULT 0,
 failures INTEGER NOT NULL DEFAULT 0,
 last_error TEXT,
 stopped_at INTEGER,
 finished_at INTEGER,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE data_runner_fences (
 id TEXT PRIMARY KEY NOT NULL,
 held INTEGER NOT NULL CONSTRAINT data_runner_superseded CHECK(held=1)
);
