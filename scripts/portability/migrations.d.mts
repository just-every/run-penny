import type { ArchivePolicy, MigrationReplay } from '@runeditrun/rer/modules/portability'
export function restoreMigrations(db: D1Database, policy: ArchivePolicy): Promise<MigrationReplay>
