import type { DatabaseConnection } from '@/core/platform/database'
import { RequestLifecycleError } from '../requests/lifecycle-types'

export type CategoryMode = 'off' | 'optional' | 'required'
/** Rechecked in the submission transaction as well as at HTTP admission. */
export const submissionBoardAdmission = `EXISTS(SELECT 1 FROM boards b WHERE b.id=? AND b.visibility='public'
 AND b.archived_at IS NULL AND b.posting_policy='requesters'
 AND ((b.category_mode='off' AND ? IS NULL) OR (b.category_mode='optional' AND ? IS NULL)
 OR (b.category_mode<>'off' AND EXISTS(SELECT 1 FROM request_categories c LEFT JOIN request_categories p ON p.id=c.parent_id
 WHERE c.id=? AND c.board_id=b.id AND c.archived_at IS NULL AND c.merged_into_category_id IS NULL AND (p.id IS NULL OR p.archived_at IS NULL)))))`

export async function submissionBoard(database: DatabaseConnection, slug: string, categoryId?: string | null) {
 const board = await database.binding.prepare(`SELECT id,posting_policy AS postingPolicy,category_mode AS categoryMode
 FROM boards WHERE slug=? AND visibility='public' AND archived_at IS NULL`).bind(slug).first<{id:string;postingPolicy:string;categoryMode:CategoryMode}>()
 if (!board) throw new RequestLifecycleError(409,'board_unavailable','The board is unavailable.')
 if (board.postingPolicy === 'operators') throw new RequestLifecycleError(403,'posting_disabled','Only operators may post on this board.')
 await validateCategory(database,board.id,categoryId??null,board.categoryMode)
 return board
}

export async function validateCategory(database: DatabaseConnection, boardId: string, categoryId: string | null, mode?: CategoryMode) {
 if (!categoryId) {
  if (mode === 'required') throw new RequestLifecycleError(400,'category_required','Choose a category for this board.')
  return
 }
 if (mode === 'off') throw new RequestLifecycleError(400,'categories_disabled','Categories are off for this board.')
 const exists = await database.binding.prepare(`SELECT 1 FROM request_categories c LEFT JOIN request_categories p ON p.id=c.parent_id
 WHERE c.id=? AND c.board_id=? AND c.archived_at IS NULL AND c.merged_into_category_id IS NULL AND (p.id IS NULL OR p.archived_at IS NULL)`).bind(categoryId,boardId).first()
 if (!exists) throw new RequestLifecycleError(400,'invalid_category','Choose an active category on this board.')
}
