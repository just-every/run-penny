import type { DatabaseConnection } from '@/core/platform/database'
import type { PublicBoard, PublicCategory } from '@/core/shared/api/public'
import { publicRequestPredicate } from '../requests/publication-predicate'
export async function publicBoards(database:DatabaseConnection):Promise<readonly PublicBoard[]>{
 const [boards,categories]=await database.binding.batch([
  database.binding.prepare(`SELECT b.id,b.slug,b.name,b.category_mode AS categoryMode,b.posting_policy AS postingPolicy,
   (SELECT labels_json FROM penny_vote_importance_settings WHERE board_id=b.id AND enabled=1) AS importanceLabels,
   b.comments_allowed AS commentsAllowed,b.show_vote_counts AS showVoteCounts,b.show_voters AS showVoters,b.anonymous_requesters AS anonymousRequesters,
   (SELECT COUNT(*) FROM requests r LEFT JOIN requesters author ON author.id=r.author_requester_id WHERE r.board_id=b.id AND ${publicRequestPredicate}) AS requestCount
   FROM boards b WHERE b.visibility='public' AND b.archived_at IS NULL ORDER BY b.position,b.name,b.slug`),
  database.binding.prepare(`SELECT c.board_id AS boardId,c.id,c.name,c.parent_id AS parentId,c.position,c.archived_at AS archivedAt,
   (SELECT COUNT(*) FROM requests r LEFT JOIN requesters author ON author.id=r.author_requester_id WHERE r.board_id=b.id
    AND (r.category_id=c.id OR r.category_id IN (SELECT child.id FROM request_categories child WHERE child.parent_id=c.id)) AND ${publicRequestPredicate}) AS requestCount
   FROM request_categories c JOIN boards b ON b.id=c.board_id WHERE b.visibility='public' AND b.archived_at IS NULL AND c.merged_into_category_id IS NULL
   ORDER BY c.position,c.name,c.id`),
 ])
 type BoardRow=Omit<PublicBoard,'categories'|'commentsAllowed'|'showVoteCounts'|'showVoters'|'anonymousRequesters'>&{id:string;commentsAllowed:number;showVoteCounts:number;showVoters:number;anonymousRequesters:number;importanceLabels:string|null}
 type CategoryRow=Omit<PublicCategory,'archived'>&{boardId:string;archivedAt:string|null}
 return (boards.results as unknown as BoardRow[]).map(({id,commentsAllowed,showVoteCounts,showVoters,anonymousRequesters,importanceLabels,...row})=>({
  ...row,importanceChoices:importanceLabels?JSON.parse(importanceLabels) as string[]:[],commentsAllowed:!!commentsAllowed,showVoteCounts:!!showVoteCounts,showVoters:!!showVoters,anonymousRequesters:!!anonymousRequesters,
  categories:(categories.results as unknown as CategoryRow[]).filter(c=>c.boardId===id).map(c=>({id:c.id,name:c.name,parentId:c.parentId,position:c.position,archived:c.archivedAt!==null,requestCount:Number(c.requestCount)})),requestCount:Number(row.requestCount),
 }))
}
