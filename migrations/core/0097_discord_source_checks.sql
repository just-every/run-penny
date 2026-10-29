-- A source read owns a durable lease; expired or superseded reads cannot commit.
-- Existing provenance, captured wording and applied migrations remain unchanged.
ALTER TABLE penny_discord_sources ADD COLUMN check_claim TEXT;
ALTER TABLE penny_discord_sources ADD COLUMN check_started_at TEXT;
