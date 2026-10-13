-- Preserve original intent and consent history without replaying restored mail.
-- Native intents remain eligible; restore explicitly stamps its archived intents.
ALTER TABLE notification_intents ADD COLUMN restoration_hold_at TEXT;
