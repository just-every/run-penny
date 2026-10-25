CREATE TABLE penny_scorecards (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL CHECK(length(trim(name))>0),
 entity TEXT NOT NULL CHECK(entity IN('requests','features')),
 revision INTEGER NOT NULL CHECK(revision>0),
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE TABLE penny_scorecard_versions (
 card_id TEXT NOT NULL REFERENCES penny_scorecards(id),
 version INTEGER NOT NULL CHECK(version>0),
 criteria_json TEXT NOT NULL CHECK(json_valid(criteria_json)),
 created_at TEXT NOT NULL,
 PRIMARY KEY(card_id,version)
);
CREATE TABLE penny_scorecard_scores (
 id TEXT PRIMARY KEY,
 card_id TEXT NOT NULL,
 version INTEGER NOT NULL,
 idea_id TEXT NOT NULL,
 scorer_id TEXT REFERENCES operators(id),
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 FOREIGN KEY(card_id,version) REFERENCES penny_scorecard_versions(card_id,version),
 UNIQUE(card_id,version,idea_id,scorer_id)
);
CREATE TABLE penny_scorecard_inputs (
 score_id TEXT NOT NULL REFERENCES penny_scorecard_scores(id),
 criterion_index INTEGER NOT NULL CHECK(criterion_index>=0),
 value INTEGER NOT NULL CHECK(value BETWEEN 1 AND 10),
 PRIMARY KEY(score_id,criterion_index)
);
