import { usePublicResource } from '../portal/ui/public-resource'
import { categoryLabel,orderedCategories,type Category } from './ui-types'
import { fieldClass } from '../auth/client-mutations'
import { fieldLabelClass,primaryButtonClass } from '@/core/ui/app/classes'
import { subformClass } from '../requests/ui/form-classes'
export function RequestCategoryForm({slug,boardId,categoryId,act}:{slug:string;boardId:string;categoryId:string|null;act:(path:string,body:unknown,method:string)=>unknown}){
 const [catalog]=usePublicResource<{categories:Category[]}>('/api/operator/catalog/settings')
 const categories=catalog.kind==='ready'?catalog.data.categories.filter(c=>c.board_id===boardId&&!c.merged_into_category_id):[]
 return <form key={categoryId??'none'} className={`${subformClass} space-y-3`} onSubmit={e=>{e.preventDefault();void act(`/api/operator/requests/${slug}/category`,{categoryId:new FormData(e.currentTarget).get('category')||null},'PATCH')}}>
  <label className={fieldLabelClass}>Public category<select name="category" className={fieldClass} defaultValue={categoryId??''} disabled={catalog.kind!=='ready'}><option value="">No category</option>{orderedCategories(categories).filter(c=>(!c.archived_at&&!categories.find(p=>p.id===c.parent_id)?.archived_at)||c.id===categoryId).map(c=><option key={c.id} value={c.id}>{categoryLabel(c,categories)}{c.archived_at?' (archived)':''}</option>)}</select></label>
  {catalog.kind==='error'?<p role="alert" className="text-sm text-penny-danger">Could not load categories.</p>:null}<button className={primaryButtonClass} disabled={catalog.kind!=='ready'}>Save category</button>
 </form>
}
