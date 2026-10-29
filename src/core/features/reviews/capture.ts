import {siteLabels} from './types'
import type {PennyRuntime} from '@/core/app/runtime'
import {guardedDatabase} from '../integrations/guarded-database'
import {NativeError,digest} from '../auth/native-tokens'
import {redactCaptured,redactionFence} from '../redaction/settings'
import {recordEvidence} from '../evidence/write-service'
import {workGuard,type Connection} from './configuration'
import {validateReview,type Review} from './adapters'
export async function capture(runtime:PennyRuntime,c:Connection,epoch:number,r:Review,clock:number){
 const raw=runtime.database.binding,db=guardedDatabase(raw,workGuard(c,epoch)),now=new Date(clock).toISOString(),fingerprint=await digest(JSON.stringify(r)),receipt=await digest(c.site+'/'+r.id)
 const existing=await db.prepare('SELECT evidence_id,source_hash,source_state FROM penny_review_sources WHERE site=? AND review_id=?').bind(c.site,r.id).first<{evidence_id:string;source_hash:string;source_state:string}>()
 if(existing){if(existing.source_hash!==fingerprint&&['current','changed'].includes(existing.source_state))await db.prepare("UPDATE penny_review_sources SET source_state='changed' WHERE evidence_id=?").bind(existing.evidence_id).run();return}
 if(await db.prepare('SELECT 1 FROM penny_review_receipts WHERE source_digest=?').bind(receipt).first())return
 const redacted=await redactCaptured(db,{...r},['author','title','text','version','country']),safe=validateReview(c,redacted.input),fence=redactionFence(db,redacted.revision)
 await recordEvidence(db,{sourceType:'review',sourceLabel:siteLabels[c.site]+' review',wording:safe.text,namedSpeaker:safe.author,observedAt:r.date.length===10?r.date+'T00:00:00Z':r.date},null,now,undefined,undefined,{systemActor:'review-capture',statements:id=>[
  fence.before,fence.after,
  db.prepare('INSERT INTO penny_review_receipts(source_digest,created_at) VALUES(?,?)').bind(receipt,now),
  db.prepare(`INSERT INTO penny_review_sources(evidence_id,connection_id,site,review_id,review_url,source_date,rating,title,app_version,country,source_hash,source_state,captured_at,next_check,ai_state) VALUES(?,?,?,?,?,?,?,?,?,?,?,'current',?,?,?)`).bind(id,c.id,c.site,r.id,r.url,r.date,safe.rating,safe.title,safe.version,safe.country,fingerprint,now,new Date(clock+86400000).toISOString(),c.extract?'pending':'stopped'),
  db.prepare('UPDATE penny_review_connections SET captured=captured+1 WHERE id=?').bind(c.id),
 ]})
}
export function errorCode(error:unknown){return error instanceof NativeError?error.code:'reviews_work_failed'}
