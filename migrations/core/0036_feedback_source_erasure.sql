-- Installation-owned checkpoints only. Existing jobs, plans, tombstones and
-- receipts stay byte-identical until an authorized privacy operation runs.
ALTER TABLE feedback_import_erasure_work ADD COLUMN source_cursor TEXT NOT NULL DEFAULT '';
ALTER TABLE feedback_import_erasure_work ADD COLUMN source_complete INTEGER NOT NULL DEFAULT 0 CHECK(source_complete IN (0,1));
