-- Configuration contains no credential; costs contain no prompt or subject data.
CREATE TABLE penny_ai_settings (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 monthly_budget_micros INTEGER NOT NULL DEFAULT 0 CHECK(monthly_budget_micros>=0),
 include_private INTEGER NOT NULL DEFAULT 0 CHECK(include_private IN(0,1))
);
CREATE TABLE penny_ai_capabilities (
 capability TEXT PRIMARY KEY,
 provider TEXT NOT NULL CHECK(provider IN('anthropic','openai')),
 model TEXT NOT NULL
);
CREATE TABLE penny_ai_runs (
 id TEXT PRIMARY KEY,
 month TEXT NOT NULL,
 capability TEXT NOT NULL,
 provider TEXT NOT NULL,
 model TEXT NOT NULL,
 reserved_micros INTEGER NOT NULL CHECK(reserved_micros>=0),
 actual_micros INTEGER,
 input_tokens INTEGER,
 output_tokens INTEGER,
 state TEXT NOT NULL CHECK(state IN('reserved','metered','uncertain','refused')),
 created_at TEXT NOT NULL
);
CREATE INDEX penny_ai_month ON penny_ai_runs(month);
