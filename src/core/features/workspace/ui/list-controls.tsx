import type {ListFilterOptions,ListOption} from '../list-options'
import {SavedViews} from '../../views/ui'
import type {SavedView,RoadmapPresentation} from '../../views/definition'
import { WorkspaceLink, useWorkspaceForm } from './workspace-link'
import { useLocation } from '@tanstack/react-router'
import { useOperatorResource, type OperatorResourceState } from '@/core/app/ui/operator-resource'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { fieldLabelClass, primaryButtonClass, secondaryButtonClass } from '@/core/ui/app/classes'
import type { OperatorPage, ListEntity } from '../list-query'
export function useOperatorList<T>(base:string):readonly [OperatorResourceState<readonly T[]>,()=>void,OperatorPage<T>|null] {
 const location=useLocation(), path=`${base}${location.searchStr}`
 const [state,retry]=useOperatorResource<OperatorPage<T>>(path)
 return [state.kind==='ready'?{kind:'ready',data:state.data.items}:state,retry,state.kind==='ready'?state.data:null]
}
export function ListControls({page,entity,hideForm=false,prefix='',presentation}:{presentation?:RoadmapPresentation;prefix?:string;hideForm?:boolean;page:{page:number;pageSize:number;total:number;savedView?:SavedView;filterOptions?:ListFilterOptions}|null;entity:ListEntity|'search'|'overview'|'updates'}) {
 const submitFilters=useWorkspaceForm()
 const location=useLocation(), params=page?.savedView?new URLSearchParams(Object.entries({...page.savedView.filter,sort:page.savedView.sort}).map(([key,value])=>[key,String(value)])):new URLSearchParams(location.searchStr),request=entity==='requests'
 const keyName=(key:string)=>prefix?`${prefix}${key[0].toUpperCase()}${key.slice(1)}`:key
 const value=(key:string)=>params.get(keyName(key))
 const clearQuery=new URLSearchParams(params);for(const key of ['q','tag','sort','page'])clearQuery.delete(keyName(key))
 const input=(key:string,label:string)=><label className={fieldLabelClass}>{label}<input name={keyName(key)} defaultValue={value(key)??''} maxLength={key==='q'?200:160} className={fieldClass}/></label>
 const options=(key:string,label:string,values:readonly string[])=><label className={fieldLabelClass}>{label}<select name={keyName(key)} defaultValue={value(key)??''} className={fieldClass}><option value="">All</option>{values.map(value=><option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select></label>
 const namedOptions=(key:string,label:string,choices:readonly ListOption[])=><label className={fieldLabelClass}>{label}<select name={keyName(key)} defaultValue={value(key)??''} className={fieldClass}><option value="">All</option>{value(key)&&!choices.some(choice=>choice.id===value(key))?<option value={value(key)!} disabled>Removed {label.toLowerCase()}</option>:null}{choices.map(choice=><option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></label>
 function pageHref(number:number){const query=new URLSearchParams(page?.savedView?{view:page.savedView.id}:params);query.set(keyName('page'),String(number));return `${location.pathname}?${query}`}
 return <div className="my-6 rounded-xl border border-penny-line bg-penny-card p-4">{entity==='requests'||entity==='evidence'||entity==='roadmap'?<SavedViews kind={entity} current={page?.savedView} presentation={presentation}/>:null}{!hideForm?<form onSubmit={submitFilters} action={location.pathname} method="get" className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4" key={params.toString()+Boolean(page?.filterOptions)}>
 {!prefix?[...params].filter(([key])=>key.startsWith('updates')).map(([key,val])=><input key={key} type="hidden" name={key} value={val}/>):null}
 {prefix?[...params].filter(([key])=>!key.startsWith(prefix)).map(([key,val])=><input key={key} type="hidden" name={key} value={val}/>):null}
 {!prefix && params.get('directory')?<input type="hidden" name="directory" value={params.get('directory')??''}/>:null}
 {!prefix?['unreviewed','attention','active'].map(key=>params.get(key)?<input key={key} type="hidden" name={key} value="true"/>:null):null}
 {input('q',entity==='search'?'Search Penny':entity==='updates'?'Search status updates':'Search')}{input('tag',entity==='updates'?'Status update tag':'Tag')}
 {entity!=='search'?<label className={fieldLabelClass}>{entity==='updates'?'Sort status updates':'Sort'}<select name={keyName('sort')} defaultValue={value('sort')??(['accounts','requesters'].includes(entity)?'name':'recent')} className={fieldClass}><option value="recent">Recent activity</option><option value="age">Oldest first</option><option value="name">Name</option>{request?<option value="votes">Vote total</option>:null}{entity==='evidence'?<option value="observed">Observed time</option>:null}</select></label>:null}
 {request?<>{options('moderation','Moderation',['awaiting_review','approved','rejected'])}{input('board','Board')}{options('status','Status',['unpublished','open','under_review','planned','in_progress','shipped','declined','withdrawn'])}{input('decision','Decision')}{input('account','Account')}</>:null}
 {entity==='evidence'?<>{options('status','Review state',['unreviewed','reviewed'])}{input('account','Account')}</>:null}
 {request||entity==='evidence'?<>{namedOptions('owner','Owner',page?.filterOptions?.owners??[])}{input('after','Created on or after (YYYY-MM-DD)')}{input('before','Created on or before (YYYY-MM-DD)')}{namedOptions('customField','Custom field',page?.filterOptions?.customFields??[])}{input('customValue','Custom field equals')}</>:null}
 {entity==='decisions'?<>{options('status','State',['draft','ready','committed','review_due'])}{input('account','Account')}</>:null}{entity==='requesters'?input('account','Account'):null}
 {entity==='roadmap'?<>{options('status','Stage',['exploring','planned','in_progress','shipped','dropped'])}{namedOptions('product','Product',page?.filterOptions?.products??[])}{namedOptions('component','Component',page?.filterOptions?.components??[])}{namedOptions('owner','Owner',page?.filterOptions?.owners??[])}</>:null}
 {entity==='releases'?options('status','State',['draft','published']):null}
 <div className="flex flex-wrap items-end gap-3 xl:col-span-4"><button className={`${primaryButtonClass} shrink-0`}>{entity==='search'?'Search':entity==='updates'?'Apply status filters':'Apply filters'}</button><WorkspaceLink className={`${secondaryButtonClass} shrink-0`} href={prefix?`${location.pathname}${clearQuery.size?`?${clearQuery}`:''}`:`${location.pathname}${params.get('directory')?'?directory=requesters':''}`}>Clear</WorkspaceLink></div>
 </form>:null}{page?<nav aria-label="List pages" className="mt-4 flex flex-wrap items-center gap-4 border-t border-penny-line pt-4"><p role="status" className="text-sm text-penny-muted">{page.total} {page.total === 1 ? 'result' : 'results'} · Page {page.page} of {Math.max(1,Math.ceil(page.total/page.pageSize))}</p>{page.page>1?<WorkspaceLink className={secondaryButtonClass} href={pageHref(page.page-1)}>Previous page</WorkspaceLink>:null}{page.page*page.pageSize<page.total?<WorkspaceLink className={secondaryButtonClass} href={pageHref(page.page+1)}>Next page</WorkspaceLink>:null}</nav>:null}</div>
}
