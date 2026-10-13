import type { DatabaseConnection } from '../../platform/database'
import { importAccountsSample } from '../accounts/service'
import { importCatalogSample } from '../catalog/service'
import { importDecisionsSample } from '../decisions/service'
import { importEvidenceSample } from '../evidence/service'
import { importReleasesSample } from '../releases/service'
import { importRequestsSample } from '../requests/service'
import { importRoadmapSample } from '../roadmap/service'
import { assertUnique } from '../../shared/ids'
import { pennySampleSchema, type PennySample } from './schema'
import type { SampleImportResult } from './types'

function requireReferences(values: readonly (string | null)[], available: Set<string>, label: string): void {
  for (const value of values) {
    if (value !== null && !available.has(value)) {
      throw new Error(`${label} references missing record ${value}`)
    }
  }
}

function validateSampleGraph(sample: PennySample): void {
  const operatorIds = new Set(sample.operators.map((record) => record.id))
  const accountIds = new Set(sample.accounts.map((record) => record.id))
  const requesterIds = new Set(sample.requesters.map((record) => record.id))
  const requesterAddressIds = new Set(sample.requesters.map((record) => record.addressId))
  const boardIds = new Set(sample.boards.map((record) => record.id))
  const tagIds = new Set(sample.tags.map((record) => record.id))
  const evidenceIds = new Set(sample.evidence.map((record) => record.id))
  const evidenceVersionIds = new Set(sample.evidence.map((record) => record.versionId))
  const requestIds = new Set(sample.requests.map((record) => record.id))
  const decisionIds = new Set(sample.decisions.map((record) => record.id))
  const candidateBetToDecisionId = new Map(sample.decisions.flatMap((decision) => decision.bets.map((bet) => [bet.id, decision.id])))
  const candidateBetIds = new Set(candidateBetToDecisionId.keys())
  const roadmapIds = new Set(sample.roadmapItems.map((record) => record.id))

  assertUnique(sample.evidence.flatMap((record) => [record.id, record.versionId]), 'sample evidence item/version IDs')
  assertUnique(sample.requests.flatMap((record) => [record.id, ...record.comments.map((comment) => comment.id)]), 'sample request/comment IDs')
  assertUnique(sample.decisions.flatMap((record) => [record.id, ...record.bets.map((bet) => bet.id), ...(record.revision === null ? [] : [record.revision.id, ...record.revision.snapshots.map((snapshot) => snapshot.id)])]), 'sample decision IDs')
  assertUnique(sample.roadmapItems.flatMap((record) => [record.id, record.transition.id]), 'sample roadmap IDs')
  assertUnique(sample.roadmapPublications.map((record) => record.id), 'sample roadmap publication IDs')
  assertUnique(sample.roadmapPublications.map((record) => record.roadmapItemId), 'sample roadmap publication item IDs')
  assertUnique(sample.roadmapRequestMappings.map((record) => record.requestId), 'sample roadmap mapping request IDs')
  assertUnique(sample.releases.flatMap((record) => [record.id, record.version.id]), 'sample release IDs')

  requireReferences(sample.accounts.map((record) => record.internalOwnerId), operatorIds, 'account owner')
  requireReferences(sample.requesters.map((record) => record.accountId), accountIds, 'requester account')
  requireReferences(sample.evidence.flatMap((record) => [record.accountId, record.requesterId, record.recordedByOperatorId, ...record.tagIds]), new Set([...accountIds, ...requesterIds, ...operatorIds, ...tagIds]), 'evidence')

  for (const record of sample.evidence) {
    requireReferences([record.accountId], accountIds, `evidence ${record.id} account`)
    requireReferences([record.requesterId], requesterIds, `evidence ${record.id} requester`)
    requireReferences([record.recordedByOperatorId], operatorIds, `evidence ${record.id} recorder`)
    requireReferences(record.tagIds, tagIds, `evidence ${record.id} tags`)
  }
  for (const record of sample.requests) {
    requireReferences([record.boardId], boardIds, `request ${record.id} board`)
    requireReferences([record.authorRequesterId, ...record.voterIds, ...record.followerIds], requesterIds, `request ${record.id} requester`)
    requireReferences(record.evidenceIds, evidenceIds, `request ${record.id} evidence`)
    requireReferences(record.tagIds, tagIds, `request ${record.id} tags`)
    requireReferences(record.comments.map((comment) => comment.requesterId), requesterIds, `request ${record.id} comment requester`)
    requireReferences(record.comments.map((comment) => comment.operatorId), operatorIds, `request ${record.id} comment operator`)
  }
  for (const decision of sample.decisions) {
    requireReferences([decision.ownerOperatorId], operatorIds, `decision ${decision.id} owner`)
    requireReferences([decision.selectedCandidateBetId], candidateBetIds, `decision ${decision.id} selected bet`)
    if (decision.selectedCandidateBetId !== null && candidateBetToDecisionId.get(decision.selectedCandidateBetId) !== decision.id) {
      throw new Error(`Decision ${decision.id} selects a candidate bet from another brief`)
    }
    for (const bet of decision.bets) {
      requireReferences(bet.accountIds, accountIds, `candidate bet ${bet.id} accounts`)
      requireReferences(bet.evidenceLinks.map((link) => link.evidenceId), evidenceIds, `candidate bet ${bet.id} evidence`)
    }
    if (decision.revision !== null) {
      requireReferences([decision.revision.committedByOperatorId], operatorIds, `decision revision ${decision.revision.id} actor`)
      for (const snapshot of decision.revision.snapshots) {
        requireReferences([snapshot.evidenceId], evidenceIds, `decision snapshot ${snapshot.id} evidence`)
        requireReferences([snapshot.evidenceVersionId], evidenceVersionIds, `decision snapshot ${snapshot.id} version`)
        requireReferences([snapshot.candidateBetId], candidateBetIds, `decision snapshot ${snapshot.id} bet`)
      }
    }
  }
  for (const item of sample.roadmapItems) {
    requireReferences([item.decisionId], decisionIds, `roadmap item ${item.id} decision`)
    requireReferences([item.candidateBetId], candidateBetIds, `roadmap item ${item.id} bet`)
    requireReferences([item.ownerOperatorId, item.transition.actorOperatorId], operatorIds, `roadmap item ${item.id} actor`)
    if (item.decisionId !== null && item.candidateBetId !== null && candidateBetToDecisionId.get(item.candidateBetId) !== item.decisionId) {
      throw new Error(`Roadmap item ${item.id} links a candidate bet from another decision`)
    }
  }
  for (const release of sample.releases) {
    requireReferences([release.authorOperatorId], operatorIds, `release ${release.id} author`)
    requireReferences(release.version.subjectTagIds, tagIds, `release ${release.id} tags`)
    requireReferences(release.targetRoadmapItemIds, roadmapIds, `release ${release.id} targets`)
  }

  for (const publication of sample.roadmapPublications) {
    requireReferences([publication.roadmapItemId], roadmapIds, `roadmap publication ${publication.id} item`)
    requireReferences([publication.approvedByOperatorId], operatorIds, `roadmap publication ${publication.id} approver`)
  }
  for (const mapping of sample.roadmapRequestMappings) {
    requireReferences([mapping.roadmapItemId], roadmapIds, `roadmap request mapping ${mapping.requestId} item`)
    requireReferences([mapping.requestId], requestIds, `roadmap request mapping ${mapping.requestId} request`)
    if (mapping.approvedAt !== null && !sample.roadmapPublications.some((publication) => publication.roadmapItemId === mapping.roadmapItemId && publication.withdrawnAt === null)) {
      throw new Error(`Approved roadmap mapping ${mapping.requestId} needs an active roadmap publication`)
    }
  }

  // The snapshot model is present in the schema even though the initial sample
  // has no published release. Keep its identity namespace distinct now.
  assertUnique([...requesterAddressIds], 'sample requester address IDs')
  assertUnique([...requestIds], 'sample request IDs')
}

export async function importPennySample(database: DatabaseConnection, payload: unknown, now = new Date().toISOString()): Promise<SampleImportResult> {
  const sample = pennySampleSchema.parse(payload)
  validateSampleGraph(sample)

  await importAccountsSample(database, sample, now)
  await importCatalogSample(database, sample, now)
  await importEvidenceSample(database, sample.evidence, now)
  await importRequestsSample(database, sample.requests, now)
  await importDecisionsSample(database, sample.decisions, now)
  await importRoadmapSample(database, sample.roadmapItems, sample.roadmapPublications, sample.roadmapRequestMappings, now)
  await importReleasesSample(database, sample.releases, sample.roadmapItems, now)

  return {
    version: sample.version,
    attemptedRows: {
      operators: sample.operators.length,
      accounts: sample.accounts.length,
      requesters: sample.requesters.length,
      boards: sample.boards.length,
      tags: sample.tags.length,
      evidenceItems: sample.evidence.length,
      evidenceVersions: sample.evidence.length,
      requests: sample.requests.length,
      requestComments: sample.requests.reduce((count, request) => count + request.comments.length, 0),
      decisions: sample.decisions.length,
      candidateBets: sample.decisions.reduce((count, decision) => count + decision.bets.length, 0),
      decisionRevisions: sample.decisions.filter((decision) => decision.revision !== null).length,
      decisionEvidenceSnapshots: sample.decisions.reduce((count, decision) => count + (decision.revision?.snapshots.length ?? 0), 0),
      roadmapItems: sample.roadmapItems.length,
      roadmapTransitions: sample.roadmapItems.length,
      roadmapPublications: sample.roadmapPublications.length,
      roadmapRequestMappings: sample.roadmapRequestMappings.length,
      releases: sample.releases.length,
      releaseVersions: sample.releases.length,
    },
  }
}
