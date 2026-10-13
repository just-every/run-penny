import { insertSampleRows } from '../sample-data/insert'
import type { DatabaseConnection } from '../../platform/database'
import { roadmapItems, roadmapPublications, roadmapRequestMappings, roadmapTransitions } from '../../shared/schema'
import type { PennySample } from '../sample-data/schema'

export class RoadmapRepository {
  private readonly binding: D1Database

  constructor(connection: DatabaseConnection) {
    this.binding = connection.binding
  }

  async insertRoadmapItems(records: PennySample['roadmapItems'], now: string): Promise<void> {
    if (records.length === 0) return
    await insertSampleRows(this.binding, roadmapItems, records.map((record) => ({
      id: record.id,
      slug: record.slug,
      decisionId: record.decisionId,
      candidateBetId: record.candidateBetId,
      title: record.title,
      summary: record.summary,
      ownerOperatorId: record.ownerOperatorId,
      status: record.status,
      targetWindow: record.targetWindow,
      deliveryNotes: record.deliveryNotes,
      confidence: record.confidence,
      createdAt: now,
      updatedAt: now,
    })))
    await insertSampleRows(this.binding, roadmapTransitions, records.map((record) => ({
      id: record.transition.id,
      roadmapItemId: record.id,
      fromStatus: record.transition.fromStatus,
      toStatus: record.transition.toStatus,
      reason: record.transition.reason,
      actorOperatorId: record.transition.actorOperatorId,
      createdAt: now,
      updatedAt: now,
    })))
  }

  async insertPublicProjections(
    publications: PennySample['roadmapPublications'],
    mappings: PennySample['roadmapRequestMappings'],
    now: string,
  ): Promise<void> {
    if (publications.length > 0) {
      await insertSampleRows(this.binding, roadmapPublications, publications.map((record) => ({
        ...record,
        createdAt: now,
        updatedAt: now,
      })))
    }

    if (mappings.length > 0) {
      await insertSampleRows(this.binding, roadmapRequestMappings, mappings.map((record) => ({
        ...record,
        createdAt: now,
        updatedAt: now,
      })))
    }
  }
}
