/** Captured wording and its durable copies. Custody-bound places are counted,
 * never silently rewritten: DATA-003's erasure doors remain their privacy path. */
export interface Place {table:string;label:string;columns:string[];reason?:string;key?:string;where?:string}
// SQLite materializes this uncorrelated IN set once per bounded page, rather
// than walking every import's JSON again for every native row.
const imported=(table:string)=>"t.id IN (SELECT json_extract(k.value,'$.keys.id') FROM feedback_import_records f,json_each(f.row_keys_json) k WHERE json_extract(k.value,'$.table')='"+table+"' AND json_extract(k.value,'$.keys.id') IS NOT NULL)"
const mutable=(table:string,label:string,columns:string):Place=>({table,label,columns:columns.split(','),where:'NOT ('+imported(table)+')'})
const held=(table:string,label:string,reason:string):Place=>({table,label,columns:[],reason})
const history='Preserved history cannot be rewritten here. Review its source in Data.'
const sealed='Sealed copies cannot be rewritten here. Review their source in Data.'
export const places:Place[]=[
 mutable('evidence_versions','Evidence wording versions','wording'),
 mutable('evidence_items','Evidence labels and review notes','source_label,named_speaker,review_reason'),
 mutable('requests','Request wording and approved copies','title,description,proposed_solution,impact_statement,public_title,public_description,declined_reason'),
 mutable('request_content_submissions','Request submissions and edits','title,description,proposed_solution,impact_statement,rejection_reason'),
 mutable('request_comments','Comments','body,rejection_reason'),
 mutable('request_comment_edits','Comment edit submissions','body,rejection_reason'),
 mutable('request_notes','Internal request notes','body'),
 mutable('request_moderation_appeals','Moderation appeals','body,resolution_reason'),
 mutable('roadmap_items','Internal roadmap wording','title,summary,delivery_notes,account_impact,public_title_draft,public_summary_draft'),
 held('requester_pending_actions','Pending verified actions',sealed),
 held('native_moderation_events','Native moderation history',history),
 held('request_moderation_events','Request moderation history',history),
 held('request_status_updates','Published status history',history),
 held('decisions','Decision questions and rationale',history),
 held('candidate_bets','Decision alternatives',history),
 held('decision_revisions','Decision revision rationale',history),
 held('decision_reviews','Decision review notes',history),
 held('decision_bet_snapshots','Committed alternative snapshots',history),
 held('roadmap_publications','Approved roadmap wording',history),
 held('roadmap_transitions','Roadmap transition reasons',history),
 held('roadmap_update_versions','Roadmap update versions',sealed),
 held('roadmap_update_contexts','Roadmap recipient contexts',sealed),
 held('release_versions','Release wording and display snapshots',sealed),
 held('release_targets','Release target wording',history),
 held('release_recipient_contexts','Release recipient contexts',sealed),
 held('notification_events','Notification wording copies',history),
 held('integration_replays','Signed inbound envelopes',sealed),
 held('integration_deliveries','Outbound delivery envelopes',sealed),
 held('penny_tracker_commands','Tracker command bodies',sealed),
 held('audit_entries','Audit details that may repeat reasons',history),
 held('learning_sources','Learning source scope text',sealed),
 held('learning_investigations','Learning questions and purpose',sealed),
 held('learning_observations','Immutable learning originals',sealed),
 held('learning_artifacts','Immutable learning interpretations',sealed),
 held('learning_corrections','Learning correction history',history),
 held('learning_commitments','Immutable learning commitments',sealed),
 held('ik_jobs','Saved-import plans',sealed),
 held('ik_d1_plan_chunks','Saved-import plan chunks',sealed),
 held('ik_originals','Saved-import original records',sealed),
 held('ik_d1_original_chunks','Saved-import original chunks',sealed),
 held('feedback_import_bundles','Saved-import sealed receipts',sealed),
 held('feedback_import_original_chunks','Saved-import original file chunks',sealed),
 held('ik_provenance','Saved-import provenance copies',sealed),
 held('ik_d1_history','Saved-import previous values',sealed),
 held('ik_d1_reversal_reports','Saved-import reversal reports',sealed),
 held('ik_d1_creation_plans','Interrupted import creation copies',sealed),
 held('ik_d1_staging_pages','Import staging pages',sealed),
 held('ik_d1_staging_chunks','Import staging chunks',sealed),
 held('ik_d1_staging_headers','Import staging headers',sealed),
 held('ik_d1_native_staging_values','Import native staging values',sealed),
 held('feedback_import_records','Saved-import source identity and row custody',sealed),
 held('feedback_import_receipt_notes','Saved-import reversal receipt notes',sealed),
 held('penny_import_roadmaps','Saved-import roadmap before/after copies',sealed),
 held('request_attachment_uploads','Pending request original files','Original files keep their exact bytes. Review their source in Data.'),
 held('evidence_attachment_uploads','Pending evidence original files','Original files keep their exact bytes. Review their source in Data.'),
 held('data_operations','Archive and restore operation payloads',sealed),
 held('attachments','R2 evidence originals and filenames','Original files keep their exact bytes. Review their source in Data.'),
 held('release_attachments','R2 release originals and filenames','Original files keep their exact bytes. Review their source in Data.'),
]
// An imported native row must keep matching its sealed undo/replay witness.
places.push(...places.filter(p=>!p.reason).map(p=>({...p,key:p.table+':import-owned',label:p.label+' (saved-import custody)',columns:[],where:imported(p.table),reason:sealed})))
export const quote=(name:string)=>'"'+name+'"'
export interface PlaceCount {table:string;label:string;records:number;changes:number|null;blocked:boolean;reason?:string}
export const countFor=(place:Place,records:number):PlaceCount=>({table:place.key??place.table,label:place.label,records,changes:place.reason?null:0,blocked:!!place.reason,...(place.reason?{reason:place.reason}:{})})
