import { insertSampleRows } from '../sample-data/insert'
import { drizzle } from 'drizzle-orm/d1'
import type { DatabaseConnection } from '../../platform/database'
import {
  candidateBetAccountLinks,
  candidateBetEvidenceLinks,
  candidateBets,
  decisionEvidenceSnapshots,
  decisionRevisions,
  decisions,
} from '../../shared/schema'
import type { PennySample } from '../sample-data/schema'

export class DecisionsRepository {
  private readonly database
  private readonly binding: D1Database

  constructor(connection: DatabaseConnection) {
    this.database = drizzle(connection.binding)
    this.binding = connection.binding
  }

  async insertDecisions(records: PennySample['decisions'], now: string): Promise<void> {
    if (records.length === 0) return
    await this.database.insert(decisions).values(records.map((record) => ({
      id: record.id,
      slug: record.slug,
      title: record.title,
      question: record.question,
      state: record.state,
      ownerOperatorId: record.ownerOperatorId,
      confidence: record.confidence,
      reviewAt: record.reviewAt,
      selectedCandidateBetId: record.selectedCandidateBetId,
      rationale: record.rationale,
      createdAt: now,
      updatedAt: now,
    }))).onConflictDoNothing().run()

    const bets = records.flatMap((record) => record.bets.map((bet) => ({
      id: bet.id,
      decisionId: record.id,
      title: bet.title,
      summary: bet.summary,
      urgency: bet.urgency,
      deliveryShape: bet.deliveryShape,
      successMeasure: bet.successMeasure,
      assumptions: bet.assumptions,
      counterEvidence: bet.counterEvidence,
      createdAt: now,
      updatedAt: now,
    })))
    if (bets.length > 0) await this.database.insert(candidateBets).values(bets).onConflictDoNothing().run()

    const accountLinks = records.flatMap((record) => record.bets.flatMap((bet) => bet.accountIds.map((accountId) => ({ candidateBetId: bet.id, accountId, createdAt: now }))))
    const evidenceLinks = records.flatMap((record) => record.bets.flatMap((bet) => bet.evidenceLinks.map((link) => ({ candidateBetId: bet.id, evidenceId: link.evidenceId, stance: link.stance, createdAt: now }))))
    if (accountLinks.length > 0) await this.database.insert(candidateBetAccountLinks).values(accountLinks).onConflictDoNothing().run()
    if (evidenceLinks.length > 0) await this.database.insert(candidateBetEvidenceLinks).values(evidenceLinks).onConflictDoNothing().run()

    const revisions = records.flatMap((record) => record.revision === null ? [] : [{
      id: record.revision.id,
      decisionId: record.id,
      revisionNumber: record.revision.revisionNumber,
      selectedCandidateBetId: record.revision.selectedCandidateBetId,
      rationale: record.revision.rationale,
      confidence: record.revision.confidence,
      reviewAt: record.revision.reviewAt,
      noViableAlternativeReason: record.revision.noViableAlternativeReason,
      committedByOperatorId: record.revision.committedByOperatorId,
      createdAt: now,
      updatedAt: now,
    }])
    if (revisions.length > 0) await insertSampleRows(this.binding, decisionRevisions, revisions)

    const snapshots = records.flatMap((record) => {
      const revision = record.revision
      return revision === null ? [] : revision.snapshots.map((snapshot) => ({
        ...snapshot,
        decisionRevisionId: revision.id,
        createdAt: now,
        updatedAt: now,
      }))
    })
    if (snapshots.length > 0) await this.database.insert(decisionEvidenceSnapshots).values(snapshots).onConflictDoNothing().run()
  }
}
