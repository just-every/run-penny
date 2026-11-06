-- Native, noncommercial account-owner rules. Membership reads current accounts.
-- Creator attribution survives as an anonymous operator; rules targeting an
-- erased operator are removed by the existing reviewed erasure transaction.
CREATE TABLE penny_segments (
 id TEXT PRIMARY KEY NOT NULL,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 internal_owner_id TEXT NOT NULL REFERENCES operators(id),
 created_by_operator_id TEXT NOT NULL REFERENCES operators(id),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX penny_segments_owner ON penny_segments(internal_owner_id);
CREATE INDEX accounts_internal_owner ON accounts(internal_owner_id);
