import { NativeError } from '../auth/native-tokens'
type Row = Record<string,string|number|null>
/** The restore order may defer foreign keys; validate the board/depth invariants before taking custody. */
export function validateCategoryArchive(data: Record<string,Row[]>) {
 const categories=data.request_categories, byId=new Map(categories.map(row=>[row.id,row]))
 const invalid=()=>{throw new NativeError('invalid_category_archive',400)}
 for(const row of categories){
  const parent=byId.get(row.parent_id),target=byId.get(row.merged_into_category_id)
  if(row.parent_id!==null&&(!parent||parent.id===row.id||parent.board_id!==row.board_id||parent.parent_id!==null||parent.merged_into_category_id!==null))invalid()
  if(row.merged_into_category_id!==null&&(!target||target.id===row.id||target.board_id!==row.board_id||target.merged_into_category_id!==null||row.archived_at===null))invalid()
 }
 for(const row of data.requests)if(row.category_id!==null){const category=byId.get(row.category_id);if(!category||category.board_id!==row.board_id||category.merged_into_category_id!==null)invalid()}
}
