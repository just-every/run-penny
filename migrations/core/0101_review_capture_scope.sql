-- The configured listing may change after capture; historical provenance must
-- remain exportable. Older captures have no reconstructible scope snapshot.
ALTER TABLE penny_review_sources ADD COLUMN source_public_url TEXT;
