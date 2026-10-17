import type { DatabaseConnection } from '@/core/platform/database'
import { RequestLifecycleError } from '../requests/lifecycle-types'
import { publicRequestPredicate } from '../requests/publication-predicate'
export const commentsAllowedAdmission=`EXISTS(SELECT 1 FROM requests r JOIN boards b ON b.id=r.board_id WHERE r.id=? AND b.comments_allowed=1)`
export async function requesterCommentAdmission(database:DatabaseConnection,slug:string){
 const row=await database.binding.prepare(`SELECT b.comments_allowed FROM requests r JOIN boards b ON b.id=r.board_id LEFT JOIN requesters author ON author.id=r.author_requester_id WHERE r.slug=? AND ${publicRequestPredicate}`).bind(slug).first<{comments_allowed:number}>()
 if(!row)throw new RequestLifecycleError(404,'not_found','The published request does not exist.')
 if(!row.comments_allowed)throw new RequestLifecycleError(403,'comments_disabled','Requester comments are disabled on this board.')
}
