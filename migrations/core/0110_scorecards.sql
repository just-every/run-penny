-- Native request scorecards are private product data, independent of decisions.
CREATE TABLE penny_scorecards (
 id TEXT PRIMARY KEY,
 created_by TEXT NOT NULL REFERENCES operators(id),
 created_at TEXT NOT NULL
);
CREATE TABLE penny_scorecard_versions (
 id TEXT PRIMARY KEY,
 scorecard_id TEXT NOT NULL REFERENCES penny_scorecards(id) ON DELETE CASCADE,
 version INTEGER NOT NULL CHECK(version>0),
 name TEXT NOT NULL,
 criteria_json TEXT NOT NULL CHECK(json_valid(criteria_json)),
 created_by TEXT NOT NULL REFERENCES operators(id),
 created_at TEXT NOT NULL,
 UNIQUE(scorecard_id,version)
);
CREATE TABLE penny_scorecard_scores (
 version_id TEXT NOT NULL REFERENCES penny_scorecard_versions(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
 operator_id TEXT NOT NULL REFERENCES operators(id),
 inputs_json TEXT NOT NULL CHECK(json_valid(inputs_json)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(version_id,request_id,operator_id)
);
CREATE INDEX penny_scorecard_request_scores ON penny_scorecard_scores(request_id);
