import { invalidateTransfersStatements, redactionStatements } from '@runeditrun/rer/modules/portability/journal'
import { toD1Sql } from '@runeditrun/rer/modules/erasure/fence'
export async function portabilityErasureStatements(db) {
  const installed = await db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='rer_portability_state'").first()
  return installed ? invalidateTransfersStatements(db) : []
}
/** Portability's restore checkpoint for rewritten rows, as import-kit statements: an archive
 * made before the erasure is refused whole once the later journal is supplied. */
export async function portabilityRedactionCheckpoint(db) {
  return (await redactionStatements(db)).map(toD1Sql)
}

/** Owner-confirmed recovery also removes the retained Base snapshot. */
export async function abortPortabilitySnapshot(db, id) {
  const { abortExport } = await import('@runeditrun/rer/internal/modules/portability/export.mjs')
  return abortExport({ db }, id)
}

export async function portabilitySnapshotStatus(db, id) {
  const { exportStatus } = await import('@runeditrun/rer/internal/modules/portability/export.mjs')
  return exportStatus({ db }, id)
}

/** The actor was recorded in Penny's lock before Base could create a job. */
export async function abortPortabilityActor(db, actor) {
  const jobs = await db.prepare("SELECT id FROM rer_portability_jobs WHERE kind='export' AND actor=?").bind(actor).all()
  for (const { id } of jobs.results) await abortPortabilitySnapshot(db, id)
}
