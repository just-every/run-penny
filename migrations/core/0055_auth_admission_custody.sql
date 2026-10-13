-- Installation admission must remain available while product export/restore
-- holds maintenance. These records neither grant authority nor alter product
-- revisions, and are not portable identity or feedback data.
CREATE TABLE penny_public_admission (
 scope TEXT NOT NULL,
 subject_hash TEXT NOT NULL,
 count INTEGER NOT NULL,
 expires_at TEXT NOT NULL,
 PRIMARY KEY(scope,subject_hash)
);
CREATE INDEX penny_public_admission_expiry ON penny_public_admission(scope,expires_at);
INSERT INTO penny_public_admission(scope,subject_hash,count,expires_at)
 SELECT scope,subject_hash,count,expires_at FROM native_rate_limits
 WHERE scope IN ('public_entry','public_entry_write','public_entry_mail');

-- One opaque attempt reference, with no recipient, token, provider response,
-- or foreign key to deletable identity. A pre-send unknown survives a crash.
CREATE TABLE penny_auth_mail_attempts (
 id TEXT PRIMARY KEY,
 feature TEXT NOT NULL CHECK(feature IN ('operator_magic_link','requester_verification')),
 outcome TEXT NOT NULL CHECK(outcome IN ('accepted','development','failed','unknown')),
 phase TEXT NOT NULL CHECK(phase IN ('started','finished')),
 transport TEXT NOT NULL,
 started_at TEXT NOT NULL,
 finished_at TEXT
);
