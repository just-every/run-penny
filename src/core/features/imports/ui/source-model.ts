import { parseFeedbackCsv } from '../csv'
import { documentedColumn } from '../uservoice-columns'
import type { FeedbackStatus, SavedFeedbackInput } from '../types'

// Builds the saved-feedback bundle from the ordinary exports, in the browser.
// Every choice the importer needs (board, statuses, tags, scope) is one the
// operator sees and can change on the page; nothing is guessed silently.
export type ExportKind = 'canny' | 'canny-ideas' | 'uservoice' | 'bundle'
export type IdeaColumn = 'key' | 'title' | 'details' | 'status' | 'created' | 'author'
export type IdeaClass = 'count' | 'company' | 'revenue' | 'private'
export const pennyStatuses: readonly FeedbackStatus[] = ['open', 'under_review', 'planned', 'in_progress', 'shipped', 'declined']
export interface SavedCsv { readonly name: string; readonly base64: string; readonly headings: string[]; readonly rows: Record<string, string>[] }
export interface BuilderChoices {
  readonly boardPolicy?: import('../board-policy').FeedbackBoardPolicy
  readonly boardName: string
  readonly isPrivate: boolean
  readonly statuses: Record<string, FeedbackStatus>
  readonly tags: Record<string, string>
  readonly scope: 'complete' | 'filtered'
  readonly filter: string
  readonly columns: Partial<Record<IdeaColumn, string>>
  readonly classes: Record<string, IdeaClass>
}

export function guessStatus(source: string): FeedbackStatus {
  const text = source.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if ((pennyStatuses as readonly string[]).includes(text)) return text as FeedbackStatus
  if (['complete', 'completed', 'done', 'released', 'live'].includes(text)) return 'shipped'
  if (['closed', 'rejected', 'won’t_do', "won't_do", 'not_planned'].includes(text)) return 'declined'
  if (['started', 'building', 'in_development'].includes(text)) return 'in_progress'
  if (['reviewing', 'considering', 'gathering_feedback'].includes(text)) return 'under_review'
  return 'open'
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}
const safeName = (name: string) => name.replace(/[^a-zA-Z0-9_. -]/g, '-').slice(-100) || 'export.csv'
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'imported'

export async function readCsv(file: File): Promise<SavedCsv> {
  if (/\.xls[xm]?$/i.test(file.name)) throw new Error(`${file.name} is a spreadsheet workbook. Open it and save it as “CSV UTF-8 (Comma delimited)”, then choose the .csv file.`)
  const bytes = new Uint8Array(await file.arrayBuffer())
  let text: string
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw new Error(`${file.name} is not UTF-8 text. Save it as “CSV UTF-8” and choose it again.`) }
  let headings: string[] = []
  let rows: Record<string, string>[]
  try { rows = parseFeedbackCsv(text, found => { headings = found }) } catch { throw new Error(`${file.name} is not a readable CSV file: check that it is the export file itself, unedited.`) }
  return { name: safeName(file.name), base64: base64(bytes), headings, rows }
}

export function cannyCheck(csv: SavedCsv): string | null {
  const missing = ['Post Title', 'Post Detail', 'Date created', 'Post Status', 'Post URL'].filter(heading => !csv.headings.includes(heading))
  return missing.length ? `This is not Canny’s classic post export: it has no ${missing.join(', ')} column. For an export from the Ideas dashboard, choose “Canny Ideas view export” above.` : null
}

export function uservoiceCheck(csv: SavedCsv, voters: boolean): string | null {
  const required = voters ? ['Idea ID', 'User ID', 'Linked Idea Creation Date'] : ['Idea ID', 'Idea Title', 'Idea Description', 'Created Timestamp', 'Public Status Name']
  const missing = required.filter(heading => !csv.headings.includes(heading))
  return missing.length ? `${csv.name} is missing ${missing.join(', ')}. Include ${missing.length === 1 ? 'that column' : 'those columns'} when choosing UserVoice’s export fields.` : null
}

export const statusColumn = (kind: ExportKind, choices: Pick<BuilderChoices, 'columns'>) => kind === 'canny' ? 'Post Status' : kind === 'uservoice' ? 'Public Status Name' : choices.columns.status ?? ''
export const sourceStatuses = (csv: SavedCsv | null, column: string) => column ? [...new Set((csv?.rows ?? []).map(row => row[column] ?? ''))] : []

// Canny documents Ideas categories, not literal headings: suggest a column for
// each role from its name, and show every suggestion for the operator to change.
const ideaPatterns: Record<IdeaColumn, RegExp> = { key: /\b(id|key|url|link)\b/i, title: /title|name/i, details: /desc|detail|body/i, status: /status|stage/i, created: /creat|date/i, author: /author|creator|submitted/i }
export function guessIdeaColumns(headings: string[]): Partial<Record<IdeaColumn, string>> {
  const taken = new Set<string>(), guess: Partial<Record<IdeaColumn, string>> = {}
  for (const role of ['key', 'title', 'details', 'status', 'created', 'author'] as IdeaColumn[]) {
    const heading = headings.find(item => !taken.has(item) && ideaPatterns[role].test(item))
    if (heading) { guess[role] = heading; taken.add(heading) }
  }
  return guess
}
export function guessIdeaClass(csv: SavedCsv, heading: string): IdeaClass {
  if (/mrr|revenue/i.test(heading)) return 'revenue'
  if (/compan/i.test(heading) && !/count/i.test(heading)) return 'company'
  const cells = csv.rows.map(row => row[heading] ?? '').filter(Boolean)
  return cells.length && cells.every(cell => /^\d+$/.test(cell)) && /vote|count|insight|user|comment/i.test(heading) ? 'count' : 'private'
}
export function ideasCheck(choices: Pick<BuilderChoices, 'columns'>): string | null {
  const missing = (['key', 'title', 'details', 'status', 'created'] as IdeaColumn[]).filter(role => !choices.columns[role])
  return missing.length ? `Choose the column for each of: ${missing.join(', ')}. Penny never invents a missing idea ID, date or status.` : null
}
export const sourceTagCells = (csv: SavedCsv | null) => [...new Set((csv?.rows ?? []).map(row => row.Tags ?? '').filter(Boolean))]
export const tagNames = (text: string) => [...new Set(text.split(',').map(name => name.trim()).filter(Boolean))]
const undocumented = (csv: SavedCsv, voters: boolean) => csv.headings.filter(heading => !documentedColumn(voters ? 'uservoice-voters-csv' : 'uservoice-ideas-csv', heading))
export const uservoicePrivateColumns = (ideas: SavedCsv | null, voters: SavedCsv | null) => [...new Set([...(ideas ? undocumented(ideas, false) : []), ...(voters ? undocumented(voters, true) : [])])]

export function buildBundle(kind: Exclude<ExportKind, 'bundle'>, main: SavedCsv, voters: SavedCsv | null, choices: BuilderChoices): SavedFeedbackInput {
  const created = new Date().toISOString(), boardId = slug(choices.boardName)
  const boardPolicies=choices.boardPolicy?{[boardId]:choices.boardPolicy}:undefined
  const boards = [{ id: boardId, name: choices.boardName.trim(), isPrivate: choices.isPrivate, created }]
  const namespace = `${kind}-${slug(main.name.replace(/\.csv$/i, ''))}`.slice(0, 80)
  if (kind === 'canny-ideas') {
    const { key, title, details, status, created: date, author } = choices.columns, mapped = new Set(Object.values(choices.columns))
    const rest = main.headings.filter(heading => !mapped.has(heading))
    const aggregates = Object.fromEntries(rest.filter(heading => choices.classes[heading] && choices.classes[heading] !== 'private').map(heading => [heading, choices.classes[heading] as Exclude<IdeaClass, 'private'>]))
    const ideas = { key: key!, title: title!, details: details!, status: status!, created: date!, ...(author ? { author } : {}), aggregates, omissions: rest.filter(heading => !(heading in aggregates)) }
    return { namespace, statuses: choices.statuses, boards, ...(boardPolicies?{boardPolicies}:{}), files: [{ name: main.name, kind: 'posts', version: 'ideas-csv', boardId, base64: main.base64, ideas }] }
  }
  if (kind === 'canny') {
    const names = [...new Set(Object.values(choices.tags).flatMap(tagNames))], tagId = (name: string) => `tag-${names.indexOf(name) + 1}`
    const tagMapping = Object.fromEntries(Object.entries(choices.tags).map(([cell, text]) => [cell, tagNames(text).map(tagId)]))
    const files: SavedFeedbackInput['files'] = [{ name: main.name, kind: 'posts', version: 'classic-csv', boardId, base64: main.base64, ...(names.length ? { tagMapping } : {}) }]
    if (names.length) files.unshift({ name: 'penny-tags.json', kind: 'tags', version: 'v1', base64: base64(new TextEncoder().encode(JSON.stringify({ tags: names.map(name => ({ id: tagId(name), name, created })) }))) })
    return { namespace, statuses: choices.statuses, boards, ...(boardPolicies?{boardPolicies}:{}), files }
  }
  const uservoice = { scope: choices.scope, ...(choices.scope === 'filtered' ? { filter: choices.filter.trim() } : {}) }
  const omitted = (csv: SavedCsv, isVoters: boolean) => { const list = undocumented(csv, isVoters); return list.length ? { omissions: list } : {} }
  const files: SavedFeedbackInput['files'] = [{ name: main.name, kind: 'posts', version: 'uservoice-ideas-csv', boardId, base64: main.base64, uservoice: { ...uservoice, ...omitted(main, false) } }]
  if (voters) files.push({ name: voters.name === main.name ? 'voters-' + voters.name : voters.name, kind: 'votes', version: 'uservoice-voters-csv', base64: voters.base64, uservoice: { ...uservoice, ...omitted(voters, true) } })
  return { namespace, statuses: choices.statuses, boards, ...(boardPolicies?{boardPolicies}:{}), files }
}
