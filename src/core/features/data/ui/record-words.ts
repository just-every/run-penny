/** Plain names for the records an erasure or import preview counts. Kinds with
 * no name here are bookkeeping a person never handles; they are summed into
 * one "Other linked records" line rather than shown by their storage names. */
const words: Record<string, string> = {
  requesters: 'People', requester_addresses: 'Email addresses', requester_account_links: 'Links to accounts',
  requester_identity_merges: 'Merged identities', requester_update_permissions: 'Email permissions', requester_notification_preferences: 'Email preferences',
  requests: 'Feedback requests', request_content_submissions: 'Submitted wording', request_comments: 'Comments', request_comment_edits: 'Comment edits',
  request_votes: 'Votes', request_vote_contributions: 'Votes', request_vote_supporter_types: 'Votes', request_follows: 'Follows', request_follow_contributions: 'Follows',
  request_evidence_contributions: 'Evidence on requests', request_evidence_links: 'Evidence on requests', request_tag_assignments: 'Tags on requests',
  request_merges: 'Merged requests', request_status_updates: 'Status updates', request_notes: 'Internal notes', request_submission_keys: 'Submission reservations',
  request_moderation_events: 'Moderation history', native_moderation_events: 'Moderation history', request_notification_mutes: 'Muted notifications',
  boards: 'Boards', tags: 'Tags',
  evidence_items: 'Evidence items', evidence_versions: 'Evidence history', evidence_tag_assignments: 'Tags on evidence',
  attachments: 'Original attachments', evidence_attachment_uploads: 'Unfinished uploads', request_attachment_uploads: 'Unfinished uploads',
  accounts: 'Accounts', candidate_bet_evidence_links: 'Evidence on bets', candidate_bet_account_links: 'Accounts on bets',
  decision_evidence_snapshots: 'Evidence copies in decisions', decision_bet_snapshots: 'Bet copies in decisions', roadmap_evidence_links: 'Evidence on the roadmap',
  release_outcomes: 'Release feedback', release_recipient_snapshots: 'Release recipients', release_recipient_contexts: 'Release recipients',
  notification_outbox: 'Queued emails', notification_attempts: 'Email attempts', notification_outbox_attempts: 'Email attempts', notification_intents: 'Planned emails',
  feedback_import_records: 'Imported records', audit_anonymized: 'Audit references to anonymize',
  native_magic_links: 'Sign-in links', local_auth_outbox: 'Prepared sign-in links', native_requester_sessions: 'Requester sessions', native_rate_limits: 'Rate-limit entries',
  operators: 'Operator identity', oa_operators: 'Sign-in identity', operator_sessions: 'Operator sessions', audit_entries: 'Audit details to clear', oa_external_identities: 'Identity-provider links',
  mail_event_records: 'Email delivery events', operator_mail_suppressions: 'Email suppressions',
  'release_versions:author_name': 'Release author names', 'request_comments:public_author_display_name': 'Comment author names', 'requests:public_author_display_name': 'Feedback author names',
}
export const OTHER_RECORDS = 'Other linked records'
export const recordWords = (table: string): string => words[table] ?? OTHER_RECORDS

/** Rows of `{ table, ...counts }` merged by plain name, named rows first in
 * their given order and the bookkeeping total last. */
export function byPlainName<T extends Record<string, number>>(rows: { table: string; counts: T }[]): { name: string; counts: T }[] {
  const merged = new Map<string, T>()
  for (const { table, counts } of rows) {
    const name = recordWords(table), current = merged.get(name)
    merged.set(name, current ? Object.fromEntries(Object.entries(current).map(([key, value]) => [key, value + (counts[key] ?? 0)])) as T : { ...counts })
  }
  return [...merged].map(([name, counts]) => ({ name, counts })).sort((a, b) => Number(a.name === OTHER_RECORDS) - Number(b.name === OTHER_RECORDS))
}
