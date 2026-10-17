export interface Category {id:string;board_id:string;name:string;parent_id:string|null;position:number;archived_at:string|null;merged_into_category_id:string|null}
export function categoryLabel(category:Pick<Category,'name'|'parent_id'>,categories:readonly Category[]){
 const parent=categories.find(c=>c.id===category.parent_id)
 return `${parent?`${parent.name} / `:''}${category.name}`
}
export function orderedCategories<T extends {id:string;parent_id:string|null;position:number;name:string}>(categories:readonly T[]):T[]{
 const roots=categories.filter(c=>!c.parent_id).sort((a,b)=>a.position-b.position||a.name.localeCompare(b.name))
 return roots.flatMap(root=>[root,...categories.filter(c=>c.parent_id===root.id).sort((a,b)=>a.position-b.position||a.name.localeCompare(b.name))])
}
