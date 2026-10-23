CREATE TABLE penny_scorecards (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 entity TEXT NOT NULL CHECK(entity IN('requests','features')),
 revision INTEGER NOT NULL CHECK(revision>0),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE penny_scorecard_versions (
 id TEXT PRIMARY KEY,
 scorecard_id TEXT NOT NULL REFERENCES penny_scorecards(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL,
 criteria_json TEXT NOT NULL CHECK(json_valid(criteria_json)),
 created_at TEXT NOT NULL,
 UNIQUE(scorecard_id,revision)
);
CREATE TABLE penny_score_submissions (
 id TEXT PRIMARY KEY,
 version_id TEXT NOT NULL REFERENCES penny_scorecard_versions(id) ON DELETE CASCADE,
 idea_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
-- Attribution is a removable leaf. Erasing an operator leaves the numeric
-- submission readable without an operator identifier or a retained name.
CREATE TABLE penny_score_scorers (
 submission_id TEXT PRIMARY KEY REFERENCES penny_score_submissions(id) ON DELETE CASCADE,
 operator_id TEXT NOT NULL REFERENCES operators(id)
);
CREATE INDEX penny_score_scorers_operator ON penny_score_scorers(operator_id);
CREATE TABLE penny_score_inputs (
 submission_id TEXT NOT NULL REFERENCES penny_score_submissions(id) ON DELETE CASCADE,
 criterion_index INTEGER NOT NULL CHECK(criterion_index>=0),
 value INTEGER NOT NULL CHECK(value BETWEEN 1 AND 10),
 PRIMARY KEY(submission_id,criterion_index)
);
CREATE INDEX penny_score_submissions_idea ON penny_score_submissions(version_id,idea_id);

CREATE TRIGGER penny_score_operator_erasure AFTER UPDATE OF email ON operators
WHEN NEW.email LIKE '%@erased.invalid'
BEGIN
 DELETE FROM penny_score_scorers WHERE operator_id=NEW.id;
END;
