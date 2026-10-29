import type { BlockedCopy } from './erasure-redaction'

/** Where an operator opens each record a preview lists, and the name they know it by. */
export type CopyPlace = { label: string | null; href: string | null }
type Lookup = { sql: string; href: (row: Record<string, string | null>) => string }
const request = (slug: string | null) => `/app/moderation#request-${slug}`
const lookups: Record<string, Lookup> = {
 requests: { sql: 'SELECT COALESCE(public_title,title) label,slug FROM requests WHERE id=?', href: row => request(row.slug) },
 request_comments: { sql: 'SELECT r.title label,r.slug FROM request_comments c JOIN requests r ON r.id=c.request_id WHERE c.id=?', href: row => request(row.slug) },
 request_notes: { sql: 'SELECT r.title label,r.slug FROM request_notes n JOIN requests r ON r.id=n.request_id WHERE n.id=?', href: row => request(row.slug) },
 request_status_updates: { sql: 'SELECT r.title label,r.slug FROM request_status_updates s JOIN requests r ON r.id=s.request_id WHERE s.id=?', href: row => request(row.slug) },
 candidate_bets: { sql: 'SELECT b.title label,d.slug FROM candidate_bets b JOIN decisions d ON d.id=b.decision_id WHERE b.id=?', href: row => `/app/decisions/${row.slug}` },
 decisions: { sql: 'SELECT COALESCE(title,question) label,slug FROM decisions WHERE id=?', href: row => `/app/decisions/${row.slug}` },
 decision_revisions: { sql: 'SELECT d.question label,d.slug FROM decision_revisions v JOIN decisions d ON d.id=v.decision_id WHERE v.id=?', href: row => `/app/decisions/${row.slug}` },
 decision_reviews: { sql: 'SELECT d.question label,d.slug FROM decision_reviews v JOIN decisions d ON d.id=v.decision_id WHERE v.id=?', href: row => `/app/decisions/${row.slug}` },
 roadmap_items: { sql: 'SELECT title label,id FROM roadmap_items WHERE id=?', href: row => `/app/roadmap#roadmap-item-${row.id}` },
 roadmap_publications: { sql: 'SELECT i.title label,i.id FROM roadmap_publications p JOIN roadmap_items i ON i.id=p.roadmap_item_id WHERE p.id=?', href: row => `/app/roadmap#roadmap-item-${row.id}` },
 roadmap_transitions: { sql: 'SELECT i.title label,i.id FROM roadmap_transitions t JOIN roadmap_items i ON i.id=t.roadmap_item_id WHERE t.id=?', href: row => `/app/roadmap#roadmap-item-${row.id}` },
 evidence_items: { sql: "SELECT COALESCE(source_label,named_speaker,replace(source_type,'_',' ')) label,id FROM evidence_items WHERE id=?", href: row => `/app/feedback#evidence-${row.id}` },
 evidence_versions: { sql: "SELECT COALESCE(e.source_label,e.named_speaker,replace(e.source_type,'_',' ')) label,e.id FROM evidence_versions v JOIN evidence_items e ON e.id=v.evidence_id WHERE v.id=?", href: row => `/app/feedback#evidence-${row.id}` },
 accounts: { sql: 'SELECT name label,slug FROM accounts WHERE id=?', href: row => `/app/accounts/${row.slug}` },
 releases: { sql: 'SELECT v.title label,r.slug FROM releases r JOIN release_versions v ON v.id=r.current_version_id WHERE r.id=?', href: row => `/app/releases/${row.slug}` },
 release_versions: { sql: 'SELECT v.title label,r.slug FROM release_versions v JOIN releases r ON r.id=v.release_id WHERE v.id=?', href: row => `/app/releases/${row.slug}` },
}

export async function describeCopies(db: D1Database, copies: BlockedCopy[]): Promise<(BlockedCopy & CopyPlace)[]> {
 return Promise.all(copies.map(async copy => {
  // Saved-import holds carry their own key shape and have no page to open.
  const lookup = lookups[copy.table], [id] = lookup ? JSON.parse(copy.key) as unknown[] : []
  const row = lookup && typeof id === 'string' ? await db.prepare(lookup.sql).bind(id).first<Record<string, string | null>>() : null
  return { ...copy, label: row?.label ?? null, href: row && lookup ? lookup.href(row) : null }
 }))
}
