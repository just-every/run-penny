-- Private operator artifacts. No business decision or automatic delivery is created.
CREATE TABLE penny_ai_answers (
 id TEXT PRIMARY KEY NOT NULL,
 operator_id TEXT NOT NULL REFERENCES operators(id),
 question TEXT NOT NULL,
 response_json TEXT NOT NULL,
 context_json TEXT NOT NULL,
 cost_micros INTEGER NOT NULL CHECK(cost_micros>=0),
 created_at TEXT NOT NULL
);
CREATE INDEX penny_ai_answers_operator ON penny_ai_answers(operator_id,created_at);
