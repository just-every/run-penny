import { privateInput } from '../data/private-files.mjs'
import { hash, type ErasureJournal } from '../../src/core/features/data/archive'
import { LOCAL_DATA_LIMITS, refuse } from './policy'
export async function readJournal(path: string): Promise<ErasureJournal> {
  const value = await privateInput(path) as ErasureJournal
  const { sha256, ...body } = value
  if (value.version !== 1 || !/^[a-f0-9]{32}$/.test(value.origin) || !Number.isSafeInteger(value.epoch) || value.epoch < 0 || !Array.isArray(value.tombstones) || value.tombstones.length > LOCAL_DATA_LIMITS.rows || await hash(body) !== sha256) refuse('invalid_erasure_journal')
  return value
}
