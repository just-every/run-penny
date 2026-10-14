/** The one stderr line a failed local transfer prints: where it stopped, the
 * underlying error chain and, for a known code, why in a fixed sentence. Errors
 * from Base, the platform and SQLite carry free text that can hold a name, an
 * address or a row value, so only an allow-list is printed: the error name, its
 * code, and message tokens that are Base, Penny or platform codes. Every other
 * word is dropped, whatever it looks like. */
import { readdirSync, readFileSync } from 'node:fs'
import { constants } from 'node:os'
import { join } from 'node:path'
import inventory from '../../src/core/features/data/schema-inventory.json'

const SOURCES = ['node_modules/@runeditrun/rer/modules/portability', 'scripts/portability', 'src/core/features/data', 'src/core/features/imports', 'src/core/features/auth']
const UNDERSCORED = /\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b/g
const PLATFORM = /^(?:ERR|SQLITE|D1)_[A-Z0-9_]+$/
const STRUCTURE = Object.entries(inventory).flatMap(([table, { columns }]) => [table, ...columns.filter(column => column.includes('_'))])

/** Codes Base and Penny's portability and data sources can throw: the snake_case and
 * UPPER_SNAKE words in those sources, plus the schema's table names and underscored column names. */
function knownCodes(root: string): Set<string> {
  const known = new Set<string>([...STRUCTURE, ...Object.keys(constants.errno)])
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) { if (entry.name !== 'tests' && entry.name !== 'node_modules') visit(path) }
      else if (/\.(?:mjs|ts|mts)$/.test(entry.name)) for (const word of readFileSync(path, 'utf8').match(UNDERSCORED) ?? []) known.add(word)
    }
  }
  for (const source of SOURCES) { try { visit(join(root, source)) } catch { /* a source folder missing from this checkout adds no codes */ } }
  return known
}

const allowed = (known: Set<string>) => (token: string): boolean => known.has(token) || PLATFORM.test(token)
const tokens = (message: string): string[] => message.split(/[^A-Za-z0-9_]+/).filter(Boolean)
const WORD = /^[A-Za-z][A-Za-z0-9_]{1,63}$/

function describe(error: unknown, keep: (token: string) => boolean): string {
  if (!(error instanceof Error)) return 'non-error thrown'
  const code = 'code' in error && typeof error.code === 'string' && keep(error.code) ? error.code : ''
  const name = WORD.test(error.name) && !error.name.includes('_') ? error.name : 'Error'
  return [name, code, ...tokens(error.message).filter(token => token !== code && keep(token))].filter(Boolean).join(' ')
}

/** Why, for the codes an operator can act on. Written here, never taken from an error. */
const REASONS: Record<string, string> = {
  feedback_archive_custody_invalid: 'A saved import is still applying, undoing or rolling back; finish or reverse it in Imports, then export again.',
  data_busy: 'Another data operation holds the installation; let it finish or resume it, then try again.',
  archive_exists: 'The output archive or its erasure journal already exists; choose a new path.',
  archive_limit: 'The installation is larger than a local archive allows.',
  stale_archive: 'The erasure journal beside the archive does not belong to it; use the journal written with it.',
  erasure_journal_regression: 'This installation has erasures the archive journal lacks; restore a later archive.',
  erased_archive_record: 'The archive holds a record its erasure journal erased.',
  erased_row: 'The archive holds a row a later erasure journal erased.',
  later_journal: 'The --journal archive is not a later archive of the same installation.',
  erasure_epoch: 'The archive is older than an erasure recorded in the later journal; restore the later archive instead.',
}

/** Where a transfer stopped: its stage, and for the archive stream how many records had been read. */
export interface Progress { stage: string; records?: number }

export function failureLine(error: unknown, progress: Progress, root = process.cwd()): string {
  const keep = allowed(knownCodes(root))
  const chain: unknown[] = []
  for (let next = error; chain.length < 4 && next !== undefined; next = next instanceof Error ? next.cause : undefined) chain.push(next)
  const where = progress.records === undefined ? progress.stage : `${progress.stage} after ${progress.records} record${progress.records === 1 ? '' : 's'}`
  const described = chain.map(item => describe(item, keep)).join(' <- ')
  const reason = described.split(/[\s:]+/).map(token => REASONS[token]).find(Boolean)
  return `local_portability_failed: ${where}: ${described}${reason ? ` (${reason})` : ''}`
}
