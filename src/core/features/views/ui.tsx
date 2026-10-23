import {useHydrated} from '@/core/app/ui/hydrated'
import {CsvExports} from '../data/ui/csv-exports'
import {useState} from 'react'
import {useLocation,useRouter} from '@tanstack/react-router'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {operatorMutation} from '../requests/ui/operator-client'
import {fieldClass} from '../auth/client-mutations'
import {fieldLabelClass,primaryButtonClass,secondaryButtonClass} from '@/core/ui/app/classes'
import {validateListSearch,queryString,type ListQuery} from '../workspace/list-query'
import {viewColumns,columnLabels,type ViewKind,type SavedView,type RoadmapPresentation} from './definition'

export function SavedViews({kind,current,presentation}:{kind:ViewKind;current?:SavedView;presentation?:RoadmapPresentation}){
 const hydrated=useHydrated()
 const location=useLocation(),router=useRouter(),[views,reload]=useOperatorResource<SavedView[]>(`/api/operator/saved-views?listKind=${kind}`),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const columns=current?.columns??[...viewColumns[kind]],path=kind==='requests'?'/app/moderation':kind==='evidence'?'/app/feedback':'/app/roadmap'
 async function save(form:HTMLFormElement,replace:boolean){
  const data=new FormData(form),query=current?{...current.filter,sort:current.sort}:validateListSearch(Object.fromEntries(new URLSearchParams(location.searchStr))),{sort='recent',page,view,...filter}=query as ListQuery
  void page;void view
  setBusy(true);setMessage('')
  try{const result=await operatorMutation(replace?`/api/operator/saved-views/${current!.id}`:'/api/operator/saved-views',{listKind:kind,name:data.get('viewName'),scope:data.get('scope'),filter,sort,columns:data.getAll('column'),...(kind==='roadmap'?{presentation}:{}),...(replace?{revision:current!.revision}:{})},replace?'PUT':'POST') as {id:string};reload();await router.navigate({href:`${path}?view=${result.id}`});setMessage('View saved.')}catch(error){setMessage(error instanceof Error?error.message:'View could not be saved.')}finally{setBusy(false)}
 }
 return <section aria-label="Saved views" className="mb-5 space-y-4 border-b border-penny-line pb-5">
  <div className="flex flex-wrap items-end gap-3"><label className={fieldLabelClass}>Saved view<select className={fieldClass} disabled={!hydrated||views.kind!=='ready'} value={current?.id??''} onChange={event=>void router.navigate({href:event.target.value?`${path}?view=${event.target.value}`:path})}><option value="">Current filters</option>{views.kind==='ready'?views.data.map(view=><option key={view.id} value={view.id}>{view.name} · {view.scope}</option>):null}</select></label>{current?<p className="min-w-0 break-words text-sm">Created by {current.creatorName} · {current.scope}</p>:null}</div>
  {views.kind==='error'?<p role="alert">Saved views could not be loaded.</p>:null}
  {current?.removedFilters.map(label=><p key={label} role="status">{label}. This view returns no results until its filter is repaired.</p>)}
  <details><summary className="cursor-pointer py-2 font-semibold">Save filters, sort and columns</summary><form aria-label="Save view" key={current?.id??location.searchStr} className="mt-3 space-y-4" onSubmit={event=>{event.preventDefault();void save(event.currentTarget,false)}}>
   <div className="grid gap-4 sm:grid-cols-2"><label className={fieldLabelClass}>View name<input className={fieldClass} name="viewName" required maxLength={160} defaultValue={current?.name??''}/></label><label className={fieldLabelClass}>Visibility<select className={fieldClass} name="scope" defaultValue={current?.scope??'private'}><option value="private">Private</option><option value="shared">Shared with operators</option></select></label></div>
   <fieldset><legend className="mb-2 text-sm font-semibold">Visible fields</legend><div className="flex flex-wrap gap-4">{viewColumns[kind].map((column,index)=><label key={column} className="flex min-h-11 items-center gap-2"><input type="checkbox" name="column" value={column} defaultChecked={columns.includes(column)} disabled={index===0}/>{index===0?<input type="hidden" name="column" value={column}/>:null}{columnLabels[column]}</label>)}</div></fieldset>
   <div className="flex flex-wrap gap-3"><button disabled={busy||!hydrated} className={primaryButtonClass}>Save new view</button>{current?.canManage?<><button type="button" disabled={busy||!hydrated} className={secondaryButtonClass} onClick={event=>{if(event.currentTarget.form!.reportValidity())void save(event.currentTarget.form!,true)}}>Update view</button><button type="button" disabled={busy||!hydrated} className={secondaryButtonClass} onClick={()=>{setBusy(true);void operatorMutation(`/api/operator/saved-views/${current.id}`,{revision:current.revision},'DELETE').then(async()=>{reload();await router.navigate({href:path});setMessage('View deleted.')}).catch(error=>setMessage(String(error))).finally(()=>setBusy(false))}}>Delete view</button></>:null}</div>
  </form></details>
  {current?<a className={secondaryButtonClass} href={`${path}${queryString({...current.filter,sort:current.sort})}`}>Edit these filters</a>:null}
  {kind==='requests'?<CsvExports viewId={current?.id}/>:null}
  <p role="status" className="empty:hidden">{message}</p>
 </section>
}
