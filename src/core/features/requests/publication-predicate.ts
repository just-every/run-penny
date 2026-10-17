// Apply to aliases r (request), b (board), and author (requester).
export const publicRequestPredicate = `
  r.moderation_state = 'approved'
  AND r.published_at IS NOT NULL
  AND r.withdrawn_at IS NULL
  AND r.merged_into_request_id IS NULL
  AND r.public_state NOT IN ('unpublished','withdrawn')
  AND b.visibility = 'public'
  AND (author.id IS NULL OR author.blocked_at IS NULL)
`
