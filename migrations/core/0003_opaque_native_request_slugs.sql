-- Repair content-derived URLs in unreleased native submissions. Curated/public
-- Stage 0 records keep their approved existing URLs. Native IDs/history survive.
UPDATE requests SET slug = 'feedback-' || lower(id)
WHERE id IN (SELECT request_id FROM request_submission_keys);
