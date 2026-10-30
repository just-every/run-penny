import { voteImportanceSql } from './vote-importance'
import { nativeProxyPredicate } from './proxy-votes'
// A UserVoice proxy vote stays visibly proxy; a supporter with any unmarked
// origin vote is shown unmarked. Native and Canny votes have no source type.
const supporterOrigins = (type: string) => `EXISTS(SELECT 1 FROM request_vote_supporter_types t JOIN request_canonical_roots root ON root.origin_id = t.request_id WHERE root.canonical_id = v.request_id AND t.requester_id = v.requester_id AND t.supporter_type = '${type}')`
const supporterType = `CASE WHEN ${supporterOrigins('unmarked')} THEN 'unmarked' WHEN ${supporterOrigins('proxy')} THEN 'proxy' END`

/** Only the bound, page-scoped request selection is supplied by the reader. */
export function requestContextRowsSql(requestIdsSql: string) {
  return {
    voters: `SELECT v.request_id AS contextRequestId,r.id,r.display_name AS displayName,v.created_at AS votedAt,${supporterType} AS supporterType,${nativeProxyPredicate()} AS nativeProxy,${voteImportanceSql()} AS importance,
      (SELECT json_group_array(json_object('recorderId',proxy.recorder_operator_id,'recorderName',o.display_name,'source',proxy.source,'sourceUrl',proxy.source_url,'evidenceId',proxy.evidence_id,'recordedAt',proxy.created_at,'directVoteAt',proxy.direct_vote_at))
       FROM penny_proxy_votes proxy JOIN request_canonical_roots root ON root.origin_id=proxy.request_id JOIN operators o ON o.id=proxy.recorder_operator_id WHERE root.canonical_id=v.request_id AND proxy.requester_id=v.requester_id) AS proxyAttributionsJson,a.email,account.id AS accountId,account.slug AS accountSlug,account.name AS accountName
      FROM request_votes v JOIN requesters r ON r.id=v.requester_id AND r.blocked_at IS NULL
      LEFT JOIN requester_addresses a ON a.requester_id=r.id AND a.verified_at IS NOT NULL
      LEFT JOIN requester_account_links ral ON ral.requester_id=r.id LEFT JOIN accounts account ON account.id=ral.account_id
      WHERE v.request_id IN (${requestIdsSql}) ORDER BY r.id,a.id,account.id`,
    accounts: `SELECT DISTINCT requested.id AS contextRequestId,a.id,a.slug,a.name FROM requests requested JOIN accounts a ON
      EXISTS(SELECT 1 FROM evidence_items e JOIN request_evidence_links l ON l.evidence_id=e.id WHERE e.account_id=a.id AND l.request_id=requested.id)
      OR EXISTS(SELECT 1 FROM requester_account_links l JOIN request_votes v ON v.requester_id=l.requester_id JOIN requesters voter ON voter.id=v.requester_id AND voter.blocked_at IS NULL WHERE l.account_id=a.id AND v.request_id=requested.id)
      WHERE requested.id IN (${requestIdsSql}) ORDER BY a.name`,
    notes: `SELECT n.request_id AS contextRequestId,n.*,COALESCE((SELECT a.prepared_by FROM audit_entries a WHERE a.action='agent.tool' AND a.entity_id=n.id AND a.agent_id IS NOT NULL ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1),o.display_name) AS operator_display_name,d.name AS receiver_name FROM request_notes n
      LEFT JOIN operators o ON o.id=n.operator_id LEFT JOIN penny_integration_receipts r ON r.note_id=n.id
      LEFT JOIN penny_integration_destinations d ON r.namespace='penny-inbound:'||d.id
      WHERE n.request_id IN (${requestIdsSql}) ORDER BY n.created_at,n.id`,
    comments: `SELECT comment.request_id AS contextRequestId,comment.*,requester.display_name AS requester_display_name
      FROM request_comments comment LEFT JOIN requesters requester ON requester.id=comment.requester_id
      WHERE comment.request_id IN (${requestIdsSql}) ORDER BY comment.created_at,comment.id`,
    edits: `SELECT request_id AS contextRequestId,* FROM request_content_submissions WHERE is_initial=0 AND request_id IN (${requestIdsSql}) ORDER BY created_at,id`,
    attachments: `SELECT request_id AS contextRequestId,* FROM attachments WHERE request_id IN (${requestIdsSql}) ORDER BY created_at,id`,
    commentEdits: `SELECT comments.request_id AS contextRequestId,edits.* FROM request_comment_edits edits JOIN request_comments comments ON comments.id=edits.comment_id
      WHERE comments.request_id IN (${requestIdsSql}) ORDER BY edits.created_at,edits.id`,
    appeals: `SELECT request_id AS contextRequestId,* FROM request_moderation_appeals WHERE request_id IN (${requestIdsSql}) ORDER BY created_at,id`,
    uploads: `SELECT request_id AS contextRequestId,id,original_filename,writing FROM request_attachment_uploads WHERE request_id IN (${requestIdsSql}) ORDER BY created_at`,
    tags: `SELECT ta.request_id AS contextRequestId,t.id,t.name FROM request_tag_assignments ta JOIN tags t ON t.id=ta.tag_id
      WHERE ta.request_id IN (${requestIdsSql}) ORDER BY t.name`,
    votesByAccount: `SELECT v.request_id AS contextRequestId,a.id AS accountId,a.slug,a.name,count(DISTINCT v.requester_id) AS voteCount
      FROM request_votes v JOIN requesters r ON r.id=v.requester_id AND r.blocked_at IS NULL
      JOIN requester_account_links l ON l.requester_id=r.id JOIN accounts a ON a.id=l.account_id
      WHERE v.request_id IN (${requestIdsSql}) GROUP BY v.request_id,a.id ORDER BY a.name`,
  }
}

export type RequestContextRowName = keyof ReturnType<typeof requestContextRowsSql>
