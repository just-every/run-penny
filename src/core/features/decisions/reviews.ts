import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { guardedDatabase } from '../integrations/guarded-database'
import { audit,validDate } from './write-support'
import { commitDecision,type CommitInput } from './commit'

export interface ReviewInput {note:string;reviewAt?:string;revision?:(CommitInput&{expectedRevision:number})}
export async function reviewDecision(db:D1Database,id:string,input:ReviewInput,actor:string,now:string){
 if(!input.note.trim())throw new MutationError(422,'A review note is required.')
 if(input.revision)return commitDecision(db,id,input.revision,actor,now,{expectedRevision:input.revision.expectedRevision,note:input.note})
 if(!validDate(input.reviewAt))throw new MutationError(422,'A new calendar date or timestamp with a timezone offset is required.')
 const decision=await db.prepare('SELECT state,review_at AS reviewAt,review_generation AS generation FROM decisions WHERE id=?').bind(id).first<{state:string;reviewAt:string;generation:number}>()
 if(!decision)throw new MutationError(404,'Decision not found.')
 if(!['committed','review_due'].includes(decision.state))throw new MutationError(409,'Only committed decisions can be reviewed.')
 if(input.reviewAt===decision.reviewAt)throw new MutationError(422,'Choose a new review date.')
 const reviewId=createUlid()
 const guard={sql:"EXISTS(SELECT 1 FROM decisions WHERE id=? AND review_generation=? AND state IN('committed','review_due'))",params:[id,decision.generation]}
 try{await guardedDatabase(db,guard).batch([
  db.prepare('INSERT INTO decision_reviews(id,decision_id,operator_id,note,review_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(reviewId,id,actor,input.note,input.reviewAt!,now,now),
  db.prepare("UPDATE decisions SET state='committed',review_at=?,review_generation=review_generation+1,review_completed_at=NULL,updated_at=? WHERE id=?").bind(input.reviewAt!,now,id),
  audit(db,actor,'decision',id,'decision.reviewed',now,{reviewId}),
 ])}catch(error){if(String(error).includes('integration_authority_changed'))throw new MutationError(409,'Decision or authority changed. Refresh before reviewing.');throw error}
 return {reviewId}
}
