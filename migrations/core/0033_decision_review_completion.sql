-- A revision can complete the current review without scheduling another one.
-- Keep its date and notification generation; only a changed date re-arms it.
ALTER TABLE decisions ADD COLUMN review_completed_at TEXT;
