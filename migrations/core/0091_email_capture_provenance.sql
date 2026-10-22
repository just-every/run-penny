-- The admitted email forwarder is provenance, separate from a stated body sender.
-- Older evidence has unknown provenance; never infer it from body wording.
ALTER TABLE evidence_items ADD COLUMN admitted_sender TEXT;
