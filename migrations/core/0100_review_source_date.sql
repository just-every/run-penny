-- Keep calendar-only provenance distinct from the evidence ordering instant.
-- Prior captures retain their recorded observed_at; do not invent lost precision.
ALTER TABLE penny_review_sources ADD COLUMN source_date TEXT;
