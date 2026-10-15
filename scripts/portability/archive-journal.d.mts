import type { Manifest, Closing } from '@runeditrun/rer/modules/portability'
import type { ErasureJournal } from '../../src/core/features/data/archive'
export function archiveJournal(source: ReadableStream<Uint8Array>): Promise<{ journal: ErasureJournal; manifest: Manifest; closing: Closing }>
