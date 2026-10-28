import { observedTimeOrderSql } from './observed-time'
import type { OperatorEvidenceCard } from '@/core/shared/api/operator'
import type { DatabaseConnection } from '@/core/platform/database'
import { parseTagNamesJson } from '@/core/shared/tag-names'

export interface EvidenceReadRow {
  readonly discordJson: string | null
  readonly id: string
  readonly wording: string
  readonly admittedSender: string | null
  readonly namedSpeaker: string | null
  readonly sourceType: string
  readonly sourceLabel: string | null
  readonly observedAt: string
  readonly reviewState: 'unreviewed' | 'reviewed'
  readonly reviewReason: string | null
  readonly accountId: string | null
  readonly accountSlug: string | null
  readonly accountName: string | null
  readonly requesterId: string | null
  readonly requesterName: string | null
  readonly requesterEmail: string | null
  readonly tagsJson: string
}

export const evidenceReadSelect = `
  SELECT
    e.id AS id, ev.wording AS wording, e.named_speaker AS namedSpeaker, e.admitted_sender AS admittedSender, e.source_type AS sourceType, e.source_label AS sourceLabel,
    (SELECT json_object('jumpUrl',d.jump_url,'capturer',COALESCE(d.capturer_name,d.capturer_id),'sourceState',d.source_state,'checkFailure',d.check_failure) FROM penny_discord_sources d WHERE d.evidence_id=e.id) AS discordJson,
    e.observed_at AS observedAt, e.review_state AS reviewState, e.review_reason AS reviewReason,
    a.id AS accountId, a.slug AS accountSlug, a.name AS accountName,
    requester.id AS requesterId, requester.display_name AS requesterName,
    (
      SELECT requester_address.email
      FROM requester_addresses requester_address
      WHERE requester_address.requester_id = requester.id
      ORDER BY
        CASE
          WHEN requester_address.verified_at IS NOT NULL AND requester_address.suppressed_at IS NULL THEN 0
          WHEN requester_address.suppressed_at IS NULL THEN 1
          ELSE 2
        END,
        requester_address.created_at ASC,
        requester_address.id ASC
      LIMIT 1
    ) AS requesterEmail,
    (
      SELECT COALESCE(json_group_array(tag.name), '[]')
      FROM evidence_tag_assignments assignment
      INNER JOIN tags tag ON tag.id = assignment.tag_id
      WHERE assignment.evidence_id = e.id
    ) AS tagsJson
  FROM evidence_items e
  INNER JOIN evidence_versions ev ON ev.id = (
    SELECT current_version.id FROM evidence_versions current_version
    WHERE current_version.evidence_id = e.id ORDER BY current_version.version_number DESC LIMIT 1
  )
  LEFT JOIN accounts a ON a.id = e.account_id
  LEFT JOIN requesters requester ON requester.id = e.requester_id
`

export function mapEvidenceRead(row: EvidenceReadRow): OperatorEvidenceCard {
  return {
    id: row.id,
    ...(row.discordJson?{discord:JSON.parse(row.discordJson)}:{}),
    wording: row.wording,
    namedSpeaker: row.namedSpeaker,
    admittedSender: row.admittedSender,
    sourceType: row.sourceType,
    sourceLabel: row.sourceLabel,
    observedAt: row.observedAt,
    reviewState: row.reviewState,
    reviewReason: row.reviewReason,
    account: row.accountId && row.accountSlug && row.accountName ? { id: row.accountId, slug: row.accountSlug, name: row.accountName } : null,
    requester: row.requesterId && row.requesterName ? { id: row.requesterId, displayName: row.requesterName, email: row.requesterEmail } : null,
    tags: parseTagNamesJson(row.tagsJson),
  }
}

export class EvidenceReadRepository {
  private readonly connection: DatabaseConnection

  constructor(connection: DatabaseConnection) {
    this.connection = connection
  }

  async list(reviewState?: 'unreviewed' | 'reviewed', accountSlug?: string, ids?: readonly string[]): Promise<readonly OperatorEvidenceCard[]> {
    const conditions: string[] = []
    const values: string[] = []
    if (reviewState) {
      conditions.push('e.review_state = ?')
      values.push(reviewState)
    }
    if (accountSlug) {
      conditions.push('a.slug = ?')
      values.push(accountSlug)
    }
    if (ids) { conditions.push(`e.id IN (${ids.length ? ids.map(()=>'?').join(',') : 'NULL'})`); values.push(...ids) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await this.connection.binding.prepare(`
      ${evidenceReadSelect}
      ${where}
      ORDER BY ${observedTimeOrderSql('e.observed_at')}, e.id ASC
      LIMIT 25
    `).bind(...values).all<EvidenceReadRow>()
    return result.results.map(mapEvidenceRead)
  }
}
