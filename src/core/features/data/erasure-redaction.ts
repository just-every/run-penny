import { NativeError } from '../auth/native-tokens'
import { keyColumns, type Cell, type Row } from './archive'

/** Erasing a person removes their own records. Records that belong to the
 * business or to other people stay, without the person's words:
 * - a request the person wrote stays for everyone who voted, commented or gave
 *   evidence on it, with its author and their wording removed;
 * - a record an operator wrote that repeats the person's words (a bet, a
 *   roadmap item, approved public wording) is the owner's to decide: remove the
 *   repeated words in place, or rename it;
 * - Penny's own copies of wording (snapshots, contexts, events, history) follow
 *   the choice made for the record they copy, or lose the repeated words. */
export const MARK = '[erased]'
export const keptRedaction: Record<string, Cell> = {
 author_requester_id: null, title: 'Request from an erased person', description: 'The person who wrote this request had their data erased.',
 proposed_solution: null, impact_statement: null, approved_author_name: null, public_author_display_name: null,
}
const ownWords = ['title', 'description', 'proposed_solution', 'impact_statement']
export const keptRequestWords = (row: Row): string[] => ownWords.map(column => row[column]).filter((value): value is string => typeof value === 'string' && value.length > 0 && !Object.values(keptRedaction).includes(value))
export const keptAuthor = (request: Row, selected: Record<string, Row[]>): boolean => request.author_requester_id !== null && (selected.requesters ?? []).some(person => person.id === request.author_requester_id)

// Records an operator wrote and can open in the app.
const choices = new Set(['penny_priority_views', 'penny_products', 'penny_components', 'penny_features', 'requests', 'request_comments', 'request_notes', 'request_status_updates', 'candidate_bets', 'roadmap_items', 'roadmap_publications', 'roadmap_transitions', 'decisions', 'decision_revisions', 'decision_reviews', 'evidence_items', 'evidence_versions', 'accounts', 'release_versions', 'releases', 'boards', 'tags'])
// Penny's copies of wording made when something was committed, approved, published or sent.
const copies = new Set(['decision_bet_snapshots', 'release_targets', 'release_draft_mappings', 'roadmap_update_versions', 'roadmap_update_contexts', 'roadmap_update_histories', 'release_recipient_contexts', 'release_target_snapshots', 'notification_events', 'notification_outbox', 'notification_intents', 'notification_batches', 'request_moderation_events', 'native_moderation_events', 'roadmap_mapping_history', 'request_merges'])

export type CopyValues = Record<string, { current: string; redacted: string }>
export type BlockedCopy = { table: string; key: string; columns: string[]; resolvable?: true; values?: CopyValues }
export type Redaction = { table: string; key: string; columns: string[] }
export type CopyResolution = { table: string; key: string; resolution: 'redact' | 'rename'; values?: Record<string, string> }
const id = (table: string, key: string) => table + '\u0000' + key

/** Replaces every repeat of the person's words, longest first, including inside JSON text. */
export function redact(text: string, literals: string[]): string {
 for (const literal of [...literals].sort((a, b) => b.length - a.length)) for (const form of new Set([literal, JSON.stringify(literal).slice(1, -1)])) if (form) text = text.split(form).join(MARK)
 return text
}

export function planRedactions(found: { table: string; key: string; columns: string[] }[], kept: { table: string; key: string }[], rows: Map<string, Row>, literals: string[]): { blockedCopies: BlockedCopy[]; redactions: Redaction[] } {
 const redactions = new Map(kept.map(row => [id(row.table, row.key), { ...row, columns: Object.keys(keptRedaction) }]))
 const blockedCopies: BlockedCopy[] = []
 for (const copy of found) {
  if (copies.has(copy.table)) {
   const existing = redactions.get(id(copy.table, copy.key))
   redactions.set(id(copy.table, copy.key), { ...copy, columns: [...new Set([...(existing?.columns ?? []), ...copy.columns])] })
  } else if (choices.has(copy.table)) {
   const row = rows.get(id(copy.table, copy.key))!
   blockedCopies.push({ ...copy, resolvable: true, values: Object.fromEntries(copy.columns.map(column => [column, { current: String(row[column]), redacted: redact(String(row[column]), literals) }])) })
  } else blockedCopies.push(copy)
 }
 return { blockedCopies, redactions: [...redactions.values()] }
}

function fail(code: string): never { throw new NativeError(code, 409) }
/** Every listed record needs exactly one choice; a new name may not repeat the person's words. */
export function checkCopyResolutions(blocked: BlockedCopy[], resolutions: CopyResolution[], literals: string[]): void {
 if (blocked.some(copy => !copy.resolvable) || resolutions.length !== blocked.length) fail('erasure_ambiguous_copies')
 for (const copy of blocked) {
  const chosen = resolutions.filter(item => item.table === copy.table && item.key === copy.key)
  if (chosen.length !== 1) fail('erasure_ambiguous_copies')
  if (chosen[0].resolution !== 'rename') continue
  const values = chosen[0].values ?? {}
  if ([...Object.keys(values)].sort().join() !== [...copy.columns].sort().join() || Object.values(values).some(text => !text.trim())) fail('erasure_ambiguous_copies')
  if (Object.values(values).some(text => literals.some(literal => text.includes(literal)))) fail('erasure_rename_repeats')
 }
}

// A kept request is named by its approved public wording once that no longer
// repeats the person's words; otherwise by the neutral placeholder.
function kept(row: Row, chosen: Record<string, Cell>, column: string): Cell {
 const source = column === 'title' ? 'public_title' : column === 'description' ? 'public_description' : null
 const value = source ? (source in chosen ? chosen[source] : row[source]) : null
 return typeof value === 'string' && value.trim() && !value.includes(MARK) ? value : keptRedaction[column]
}
type Table = { name: string; columns: { name: string; pk: number }[] }
/** The in-place updates, made in the erasure's one transaction. */
export function redactionStatements(db: D1Database, tables: Table[], plan: { blockedCopies: BlockedCopy[]; redactions: Redaction[]; rows: Map<string, Row> }, resolutions: CopyResolution[], literals: string[]): D1PreparedStatement[] {
 const updates = new Map<string, { table: string; key: string; set: Record<string, Cell> }>()
 const update = (table: string, key: string, set: Record<string, Cell>) => { const at = id(table, key); updates.set(at, { table, key, set: { ...updates.get(at)?.set, ...set } }) }
 // A copy takes the choice made for the record it copies: a committed bet's copy
 // follows that bet, and any other copy follows the one choice made for the same
 // wording. A copy whose wording got different choices loses the words.
 const follow = new Map<string, string | null>(), chosen = new Map<string, Record<string, Cell>>()
 for (const copy of plan.blockedCopies) {
  const choice = resolutions.find(item => item.table === copy.table && item.key === copy.key)!, row = plan.rows.get(id(copy.table, copy.key))!
  const set = Object.fromEntries(copy.columns.map(column => [column, choice.resolution === 'rename' ? choice.values![column] : redact(String(row[column]), literals)]))
  for (const column of copy.columns) { const old = String(row[column]); follow.set(old, follow.has(old) && follow.get(old) !== set[column] ? null : String(set[column])) }
  chosen.set(id(copy.table, copy.key), set)
  update(copy.table, copy.key, set)
 }
 for (const redaction of plan.redactions) {
  const row = plan.rows.get(id(redaction.table, redaction.key))!, bet = redaction.table === 'decision_bet_snapshots' ? chosen.get(id('candidate_bets', JSON.stringify([row.candidate_bet_id]))) : undefined
  update(redaction.table, redaction.key, Object.fromEntries(redaction.columns.map(column => [column, column in keptRedaction && redaction.table === 'requests' ? kept(row, updates.get(id(redaction.table, redaction.key))?.set ?? {}, column) : bet && column in bet ? bet[column] : follow.get(String(row[column])) ?? redact(String(row[column]), literals)])))
 }
 const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"'
 return [...updates.values()].map(({ table, key, set }) => {
  const definition = tables.find(item => item.name === table)!, keys = keyColumns(definition), values = JSON.parse(key) as Cell[]
  return db.prepare(`UPDATE ${quote(table)} SET ${Object.keys(set).map(column => quote(column) + '=?').join(',')} WHERE ${keys.map(column => quote(column.name) + ' IS ?').join(' AND ')}`).bind(...Object.values(set), ...values)
 })
}
export const rowsKey = id
