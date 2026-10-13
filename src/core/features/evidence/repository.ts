import { drizzle } from 'drizzle-orm/d1'
import type { DatabaseConnection } from '../../platform/database'
import { evidenceTagAssignments, evidenceVersions } from '../../shared/schema'
import type { PennySample } from '../sample-data/schema'

export class EvidenceRepository {
  private readonly database
  private readonly binding: D1Database

  constructor(connection: DatabaseConnection) {
    this.database = drizzle(connection.binding)
    this.binding = connection.binding
  }

  async insertEvidence(records: PennySample['evidence'], now: string): Promise<void> {
    if (records.length === 0) return
    // Sample format v1 supplies only these original columns. Omit later optional
    // provenance columns so the same importer can populate a prior-schema upgrade.
    await this.binding.batch(records.map(record => this.binding.prepare(`INSERT INTO evidence_items
      (id,source_type,source_label,account_id,requester_id,recorded_by_operator_id,observed_at,review_state,review_reason,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`).bind(record.id,record.sourceType,record.sourceLabel,record.accountId,record.requesterId,record.recordedByOperatorId,record.observedAt,record.reviewState,record.reviewReason,now,now)))
    await this.database.insert(evidenceVersions).values(records.map((record) => ({
      id: record.versionId,
      evidenceId: record.id,
      versionNumber: 1,
      wording: record.wording,
      editedByOperatorId: record.recordedByOperatorId,
      createdAt: now,
      updatedAt: now,
    }))).onConflictDoNothing().run()
    const assignments = records.flatMap((record) => record.tagIds.map((tagId) => ({ evidenceId: record.id, tagId, createdAt: now })))
    if (assignments.length > 0) {
      await this.database.insert(evidenceTagAssignments).values(assignments).onConflictDoNothing().run()
    }
  }
}
