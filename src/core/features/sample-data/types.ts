import type { PennySample } from './schema'

export interface SampleImportResult {
  version: PennySample['version']
  attemptedRows: Record<string, number>
}
