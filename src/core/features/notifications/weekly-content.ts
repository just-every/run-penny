/** A selected address is rechecked against live consent; historical votes are never an audience. */
const consent=`SELECT c.requester_id,c.address_id,c.granted_at,1 AS explicit FROM penny_weekly_choices c JOIN requester_addresses a ON a.id=c.address_id
 WHERE c.subscribed=1 AND c.revoked_at IS NULL AND c.verification_epoch=a.verification_epoch
 UNION ALL SELECT p.requester_id,p.requester_address_id,p.granted_at,0 FROM requester_update_permissions p
 WHERE p.grant_origin='vote_subscription' AND p.revoked_at IS NULL AND p.suppressed_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM penny_weekly_choices c WHERE c.requester_id=p.requester_id)`
export const weeklyAudience=`SELECT DISTINCT consent.requester_id,consent.address_id FROM (${consent}) consent
 JOIN requester_addresses a ON a.id=consent.address_id AND a.requester_id=consent.requester_id JOIN requesters person ON person.id=consent.requester_id
 WHERE a.verified_at IS NOT NULL AND a.suppressed_at IS NULL AND person.blocked_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM requester_identity_merges m WHERE m.source_requester_id=person.id)
 AND NOT EXISTS(SELECT 1 FROM requester_notification_preferences p WHERE p.requester_id=person.id AND p.muted_at IS NOT NULL)`
const followed=`SELECT r.id,r.slug,r.public_title AS title,MAX(f.created_at,recipient.enabled_at,CASE WHEN recipient.explicit=1 THEN recipient.granted_at ELSE
 (SELECT MIN(p.granted_at) FROM requester_update_permissions p JOIN request_canonical_roots root ON root.origin_id=p.request_id WHERE p.requester_id=recipient.requester_id AND p.requester_address_id=recipient.address_id AND p.grant_origin='vote_subscription' AND p.revoked_at IS NULL AND p.suppressed_at IS NULL AND root.canonical_id=r.id) END) AS since FROM recipient JOIN requests r
 JOIN request_follows f ON f.request_id=r.id AND f.requester_id=recipient.requester_id AND f.muted_at IS NULL
 JOIN boards b ON b.id=r.board_id LEFT JOIN requesters author ON author.id=r.author_requester_id
 WHERE r.moderation_state='approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL AND b.visibility='public'
 AND (author.id IS NULL OR author.blocked_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM request_notification_mutes m JOIN request_canonical_roots root ON root.origin_id=m.request_id WHERE m.requester_id=recipient.requester_id AND root.canonical_id=r.id)
 AND (recipient.explicit=1 OR EXISTS(SELECT 1 FROM requester_update_permissions p JOIN request_canonical_roots root ON root.origin_id=p.request_id
 WHERE p.requester_id=recipient.requester_id AND p.requester_address_id=recipient.address_id AND p.grant_origin='vote_subscription' AND p.revoked_at IS NULL AND p.suppressed_at IS NULL AND root.canonical_id=r.id))`
export const weeklyContentSql=`WITH recipient AS MATERIALIZED (
 SELECT n.requester_id,n.address_id,a.email,a.verification_epoch,consent.granted_at,consent.explicit,s.enabled_at,json_extract(n.payload_json,'$.start') AS start,json_extract(n.payload_json,'$.end') AS end
 FROM notification_outbox n JOIN (${consent}) consent ON consent.requester_id=n.requester_id AND consent.address_id=n.address_id
 JOIN requester_addresses a ON a.id=n.address_id JOIN (${weeklyAudience}) audience ON audience.requester_id=n.requester_id AND audience.address_id=n.address_id
 JOIN penny_weekly_summary s ON s.singleton=1 AND s.enabled=1 WHERE n.id=? AND consent.granted_at<json_extract(n.payload_json,'$.end')
 ORDER BY consent.explicit DESC,consent.granted_at LIMIT 1),
 followed AS MATERIALIZED (${followed}),
 changes AS (
 SELECT e.id,r.title,'/portal/feedback/'||r.slug AS path,CASE WHEN e.kind='comment' THEN c.body ELSE CASE WHEN status.body='' THEN 'Status changed to '||replace(status.public_status,'_',' ') ELSE status.body END END AS body,e.created_at
 FROM recipient JOIN notification_events e JOIN followed r ON r.id=e.request_id
 LEFT JOIN request_comments c ON e.kind='comment' AND c.id=e.subject_id LEFT JOIN request_status_updates status ON e.kind='status' AND status.id=e.subject_id
 WHERE EXISTS(SELECT 1 FROM notification_intents i WHERE i.event_id=e.id AND i.requester_id=recipient.requester_id AND i.address_id=recipient.address_id AND i.restoration_hold_at IS NULL) AND e.roadmap_update_version_id IS NULL AND e.created_at>=MAX(recipient.start,r.since) AND e.created_at<recipient.end
 AND ((e.kind='status' AND status.id IS NOT NULL) OR (e.kind='comment' AND c.historical_private=0 AND c.moderation_state='approved' AND c.published_at IS NOT NULL AND c.requester_id IS NOT recipient.requester_id
 AND (c.requester_id IS NULL OR EXISTS(SELECT 1 FROM requesters WHERE id=c.requester_id AND blocked_at IS NULL))))
 UNION SELECT v.id,r.title,'/portal/feedback/'||r.slug,v.body,v.published_at FROM recipient JOIN notification_events e JOIN roadmap_update_versions v ON v.id=e.roadmap_update_version_id
 JOIN roadmap_request_mappings m ON m.roadmap_item_id=v.roadmap_item_id JOIN followed r ON r.id=m.request_id JOIN roadmap_publications p ON p.roadmap_item_id=m.roadmap_item_id
 WHERE EXISTS(SELECT 1 FROM notification_intents i WHERE i.event_id=e.id AND i.requester_id=recipient.requester_id AND i.address_id=recipient.address_id AND i.restoration_hold_at IS NULL) AND m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL AND p.approved_at IS NOT NULL AND p.withdrawn_at IS NULL
 AND v.published_at>=MAX(recipient.start,r.since) AND v.published_at<recipient.end
 UNION SELECT v.id,v.title,'/portal/updates/'||release.slug,v.body,original.snapshot_sealed_at FROM recipient JOIN releases release
 JOIN release_versions v ON v.id=release.current_version_id AND v.is_portal_current=1 JOIN release_versions original ON original.id=COALESCE(v.original_publication_version_id,v.id)
 WHERE EXISTS(SELECT 1 FROM penny_weekly_publications live WHERE live.version_id=original.id AND live.held=0) AND release.state='published' AND original.snapshot_sealed_at>=MAX(recipient.start,recipient.granted_at,recipient.enabled_at) AND original.snapshot_sealed_at<recipient.end
 AND (recipient.explicit=1 OR EXISTS(SELECT 1 FROM release_target_snapshots target JOIN followed r ON r.id=target.request_id WHERE target.version_id=original.id)))
 SELECT email,verification_epoch AS verificationEpoch,explicit,(SELECT json_group_array(json_object('title',title,'body',body,'path',path)) FROM (SELECT * FROM changes ORDER BY created_at,id,path)) AS items
 FROM recipient WHERE EXISTS(SELECT 1 FROM changes)`
export interface WeeklyContent {email:string;verificationEpoch:number;explicit:number;items:string}
export async function weeklyContent(db:D1Database,id:string){return db.prepare(weeklyContentSql).bind(id).first<WeeklyContent>()}
export async function admitWeekly(db:D1Database,id:string,claim:string,email:string,epoch:number){
 const [content,owned]=await db.batch([db.prepare(weeklyContentSql).bind(id),db.prepare(`UPDATE notification_outbox_attempts SET recipient_email=?,recipient_verification_epoch=?
 WHERE id=? AND outbox_id=? AND state='sending' AND recipient_email IS NULL AND EXISTS(SELECT 1 FROM notification_outbox WHERE id=? AND claim_id=? AND delivery_state='queued')
 AND EXISTS(SELECT 1 FROM (${weeklyContentSql}) WHERE email=? AND verificationEpoch=?) AND (SELECT phase FROM data_state WHERE singleton=1)='idle' RETURNING 1`).bind(email,epoch,claim,id,id,claim,id,email,epoch)])
 return {content:content.results[0] as unknown as WeeklyContent|undefined,owned:owned.results.length===1}
}
