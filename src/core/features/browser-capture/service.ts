import type {Session} from '../../../../base/modules/operator-auth/index.mjs'
import {NativeError} from '../auth/native-tokens'
import {MutationError} from '@/core/app/operator-mutations'
import {recordEvidence} from '../evidence/write-service'
import {redactCaptured,redactionFence} from '../redaction/settings'
import {audit} from '../decisions/write-support'
import {digest,sourceFingerprint,type CaptureInput,type Capture} from './schema'

export const readCapture=(db:D1Database,id:string)=>db.prepare('SELECT b.*,e.observed_at,e.named_speaker,(SELECT wording FROM evidence_versions v WHERE v.evidence_id=e.id ORDER BY v.version_number DESC LIMIT 1) AS wording,p.display_name AS requester_name,r.title AS request_title,o.display_name AS owner_name FROM penny_browser_captures b JOIN evidence_items e ON e.id=b.evidence_id LEFT JOIN requesters p ON p.id=b.requester_id LEFT JOIN requests r ON r.id=b.request_id LEFT JOIN operators o ON o.id=b.actor_id WHERE b.id=?').bind(id).first<Capture>()
export async function startCapture(db:D1Database,input:CaptureInput,actor:string,session:Session,now:string){
 if(session.operator.role!=='owner'&&input.purgeDays!==30)throw new NativeError('browser_retention_owner_required',403,'Only the workspace owner can change the default 30-day excerpt-retention window.')
 const hash=await digest(JSON.stringify(input)),receipt=await digest(input.id)
 const prior=await readCapture(db,input.id)
 if(prior){if(prior.payload_hash!==hash)throw new MutationError(409,'This capture already has different wording or choices. Start a new capture.');return prior}
 if(await db.prepare('SELECT 1 FROM penny_browser_receipts WHERE capture_digest=?').bind(receipt).first())throw new MutationError(409,'This capture was erased. It cannot be replayed.')
 const customer=input.requesterId?await db.prepare("SELECT id,display_name FROM requesters WHERE id=? AND blocked_at IS NULL AND NOT EXISTS(SELECT 1 FROM requester_identity_merges WHERE source_requester_id=?)").bind(input.requesterId,input.requesterId).first<{id:string;display_name:string}>():null
 if(input.requesterId&&!customer)throw new MutationError(409,'Choose an active customer.')
 const request=input.requestId?await db.prepare('SELECT id FROM requests WHERE id=? AND withdrawn_at IS NULL AND merged_into_request_id IS NULL').bind(input.requestId).first():null
 if(input.requestId&&!request)throw new MutationError(409,'Choose a current request.')
 const safe=await redactCaptured(db,{url:input.pageUrl,speaker:input.namedSpeaker||null},['url','speaker']),url=new URL(safe.input.url).href,fence=redactionFence(db,safe.revision)
 const sourceHash=await sourceFingerprint(input.wording,input.screenshot?.hash)
 try{await recordEvidence(db,{sourceType:'browser_extension',sourceLabel:null,wording:input.wording,namedSpeaker:safe.input.speaker,observedAt:input.observedAt,requestLinks:input.requestId?[{id:input.requestId,stance:'supporting'}]:[]},actor,now,undefined,undefined,{systemActor:'browser-capture',statements:evidence=>[
  fence.before,fence.after,
  db.prepare(`INSERT INTO requester_write_guards(id,permitted) VALUES(?,CASE WHEN (? IS NULL OR EXISTS(SELECT 1 FROM requesters WHERE id=? AND blocked_at IS NULL AND NOT EXISTS(SELECT 1 FROM requester_identity_merges WHERE source_requester_id=?))) AND (? IS NULL OR EXISTS(SELECT 1 FROM requests WHERE id=? AND withdrawn_at IS NULL AND merged_into_request_id IS NULL)) THEN 1 ELSE 0 END)`).bind(input.id,input.requesterId??null,input.requesterId??null,input.requesterId??null,input.requestId??null,input.requestId??null),
  db.prepare('UPDATE evidence_items SET requester_id=? WHERE id=?').bind(input.requesterId??null,evidence),
  db.prepare(`INSERT INTO penny_browser_captures(id,evidence_id,page_url,source_hash,payload_hash,purge_days,state,screenshot_hash,screenshot_bytes,request_id,requester_id,proxy_vote,actor_id,created_at,updated_at) VALUES(?,?,?,?,?,?,'uploading',?,?,?,?,?,?,?,?)`).bind(input.id,evidence,url,sourceHash,hash,input.purgeDays,input.screenshot?.hash??null,input.screenshot?.bytes??null,input.requestId??null,input.requesterId??null,Number(input.proxyVote),actor,now,now),
  db.prepare('INSERT INTO penny_browser_authority(capture_id,session_id,owner_id,owner_version) VALUES(?,?,?,?)').bind(input.id,session.id,session.operatorId,session.operator.version),
  db.prepare('INSERT INTO penny_browser_receipts(capture_digest,created_at) VALUES(?,?)').bind(receipt,now),
  db.prepare('INSERT INTO penny_evidence_owners(evidence_id,operator_id,updated_at) VALUES(?,?,?)').bind(evidence,actor,now),
  db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(input.id),
 ]})}catch(error){
  // A concurrent retry either sees the same complete transaction or refuses.
  const existing=await readCapture(db,input.id)
  if(existing?.payload_hash===hash)return existing
  throw error
 }
 return (await readCapture(db,input.id))!
}
export async function requireCapture(db:D1Database,id:string){const row=await readCapture(db,id);if(!row)throw new MutationError(404,'Browser capture not found.');return row}
export function unfinished(row:Capture){if(!['uploading','failed','held'].includes(row.state)||['removed','purged'].includes(row.source_state))throw new MutationError(409,'This capture cannot be resumed. Review its state in the inbox.')}
export async function checkSource(db:D1Database,row:Capture,input:{pageUrl:string;wording:string;screenshotHash?:string;status:number},actor:string,now:string){
 if(new URL(input.pageUrl).href!==row.page_url)throw new MutationError(409,'Open the exact captured source URL before checking it.')
 if(['removed','purged'].includes(row.source_state))throw new MutationError(409,'A removed source cannot be made current by a later browser response.')
 const removed=[401,403,404,410].includes(input.status)
 if(!removed&&input.status!==200)throw new NativeError('browser_source_check_failed',409,'The source could not be checked. Retry deliberately when it is available.')
 if(!removed&&!input.wording.trim()&&!input.screenshotHash)throw new MutationError(422,'Select the original passage or include its visible screenshot before checking.')
 const state=removed?'removed':await sourceFingerprint(input.wording,input.screenshotHash)===row.source_hash?'current':'changed'
 await db.batch([
  db.prepare("UPDATE penny_browser_captures SET source_state=CASE WHEN source_state IN('removed','purged') THEN source_state ELSE ? END,purge_at=CASE WHEN ?='removed' THEN ? ELSE purge_at END,updated_at=? WHERE id=?").bind(state,state,removed?new Date(Date.parse(now)+row.purge_days*86400000).toISOString():null,now,row.id),
  audit(db,actor,'evidence',row.evidence_id,'browser.source_checked',now,{state}),
 ])
 return requireCapture(db,row.id)
}
