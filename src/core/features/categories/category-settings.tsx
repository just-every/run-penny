import { disclosureSummaryClass,fieldLabelClass,primaryButtonClass,secondaryButtonClass } from '@/core/ui/app/classes'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { checkboxClass,checkRowClass } from '../requests/ui/form-classes'
import type { SettingsAct } from '../requests/ui/settings-boards'
import { categoryLabel,orderedCategories,type Category } from './ui-types'
export function CategorySettings({boardSlug,categories,act}:{boardSlug:string;categories:readonly Category[];act:SettingsAct}){
 const available=categories.filter(c=>!c.merged_into_category_id),base=`/api/operator/boards/${boardSlug}/categories`
 return <details className="group mt-5 border-t border-penny-line pt-1"><summary className={disclosureSummaryClass}>Public categories</summary>
  <p className="mt-3 text-sm leading-6 text-penny-muted">One level of subcategories. Archiving keeps existing assignments; merging moves requests and subcategories to the chosen category.</p>
  <div className="mt-4 space-y-4">{orderedCategories(available).map(category=><div key={`${category.id}-${JSON.stringify(category)}`} className="rounded-lg border border-penny-line p-3">
   <form className="space-y-3" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);void act(`${base}/${category.id}`,{name:data.get('name'),parentId:data.get('parent')||null,position:Number(data.get('position')),archived:data.get('archived')==='on'},'PATCH')}}>
    <label className={fieldLabelClass}>Category name<input name="name" className={fieldClass} required maxLength={160} defaultValue={category.name}/></label>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className={fieldLabelClass}>Parent<select name="parent" className={fieldClass} defaultValue={category.parent_id??''}><option value="">Top level</option>{available.filter(c=>!c.parent_id&&(!c.archived_at||c.id===category.parent_id)&&c.id!==category.id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className={fieldLabelClass}>Order<input name="position" type="number" min={0} required defaultValue={category.position} className={fieldClass}/></label></div>
    <label className={checkRowClass}><input name="archived" type="checkbox" defaultChecked={!!category.archived_at} className={checkboxClass}/>Archive category</label><button className={secondaryButtonClass}>Save category</button>
   </form>
   <form className="mt-3 space-y-3 border-t border-penny-line pt-3" onSubmit={e=>{e.preventDefault();void act(`${base}/${category.id}/merge`,{targetId:new FormData(e.currentTarget).get('target')})}}>
    <label className={fieldLabelClass}>Merge into<select name="target" className={fieldClass} required defaultValue=""><option value="" disabled>Choose category</option>{orderedCategories(available.filter(c=>!c.archived_at&&c.id!==category.id&&c.parent_id!==category.id)).map(c=><option key={c.id} value={c.id}>{categoryLabel(c,available)}</option>)}</select></label><button className={secondaryButtonClass}>Merge category</button>
   </form>
  </div>)}</div>
  <form className="mt-4 space-y-3 border-t border-penny-line pt-4" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);void act(base,{name:data.get('name'),parentId:data.get('parent')||null},'POST',e.currentTarget)}}>
   <label className={fieldLabelClass}>New category<input name="name" required maxLength={160} className={fieldClass}/></label><label className={fieldLabelClass}>Parent<select name="parent" className={fieldClass}><option value="">Top level</option>{available.filter(c=>!c.parent_id&&!c.archived_at).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className={primaryButtonClass}>Create category</button>
  </form>
 </details>
}
