import {useLocation,useParams} from '@tanstack/react-router'
import {OperatorPageHeader} from '@/core/app/ui/operator-page-header'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {OperatorResourceFailure,OperatorResourceLoading,OperatorResourceNotFound,OperatorSessionExpired} from '@/core/app/ui/operator-resource-state'
import {CustomFieldsEditor} from '../settings/ui/custom-fields-editor'
import {WorkspaceLink} from '../workspace/ui/workspace-link'
import {RequesterDirectory} from '../workspace/ui/requester-directory'
import {paperCardClass,textLinkClass} from '@/core/ui/app/classes'
import {PersonActions} from './actions'
import {PersonLink} from './links'
import {personHref,type PersonProfile} from './types'
export function PeoplePage(){return <><OperatorPageHeader eyebrow="People" title="People and the feedback they share." art={null}>Open a person to follow their requests, votes, evidence and permissions.</OperatorPageHeader><RequesterDirectory/></>}
export function PersonPage(){
 const {personId}=useParams({strict:false}) as {personId:string},page=new URLSearchParams(useLocation().searchStr).get('page')??'1'
 const [resource,reload]=useOperatorResource<PersonProfile>(`/api/operator/people/${encodeURIComponent(personId)}?page=${encodeURIComponent(page)}`)
 if(resource.kind==='loading')return <OperatorResourceLoading label="Loading person…"/>
 if(resource.kind==='session_expired')return <OperatorSessionExpired/>
 if(resource.kind==='not_found')return <OperatorResourceNotFound title="Person unavailable">This person may have been erased or the link is no longer valid.</OperatorResourceNotFound>
 if(resource.kind!=='ready')return <OperatorResourceFailure title="Could not load this person." onRetry={reload}/>
 const person=resource.data
 return <><WorkspaceLink className={textLinkClass} href="/app/people">← All people</WorkspaceLink><OperatorPageHeader eyebrow="Person" title={person.displayName} art={null}>Identity, feedback and permissions are visible only in the operator workspace.</OperatorPageHeader>
 {person.mergedIntoId?<p className="mb-5">This identity was merged. <PersonLink id={person.mergedIntoId}>Open the surviving person</PersonLink>.</p>:null}
 <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]"><div className="min-w-0 space-y-6">
 <section className={`${paperCardClass} p-5`} aria-label="Identity and accounts"><h2 className="text-xl font-bold">Identity and accounts</h2><ul className="mt-4 space-y-3">{person.addresses.map(address=><li key={address.id} className="break-words"><span className="font-semibold [overflow-wrap:anywhere]">{address.email}</span><p className="text-sm text-penny-muted">{address.verifiedAt?'Verified address':'Unverified address'}{address.suppressedAt?' · Suppressed':' · Not suppressed'}</p></li>)}</ul>{!person.addresses.length?<p className="mt-3 text-penny-muted">No address is available.</p>:null}<h3 className="mt-5 font-semibold">Linked accounts</h3><ul className="mt-3 space-y-3">{person.accounts.map(account=><li key={account.id} className="break-words"><WorkspaceLink className={textLinkClass} href={account.href}>{account.name}</WorkspaceLink></li>)}</ul>{!person.accounts.length?<p className="mt-3 text-penny-muted">No linked account.</p>:null}<p className="mt-4 text-sm text-penny-muted">{person.notificationMutedAt?'Workspace notifications are muted.':'Workspace notifications are not muted.'}</p><CustomFieldsEditor entityType="requester" entityId={person.id}/></section>
 {person.sections.map(section=><section key={section.key} className={`${paperCardClass} min-w-0 p-5`} aria-label={section.label}><h2 className="text-xl font-bold">{section.label}</h2><ul className="mt-4 space-y-4">{section.items.map(item=><li key={item.id} id={section.key==='permissions'?`permission-${item.id}`:undefined} className="min-w-0 break-words"><WorkspaceLink className={`${textLinkClass} [overflow-wrap:anywhere]`} href={item.href}>{item.title}</WorkspaceLink>{item.detail?<p className="mt-1 whitespace-pre-wrap text-sm text-penny-muted [overflow-wrap:anywhere]">{item.detail}</p>:null}{item.sourceUrl?<a className={`${textLinkClass} mt-2 inline-block text-sm [overflow-wrap:anywhere]`} href={item.sourceUrl} target="_blank" rel="noreferrer">Original source</a>:null}</li>)}</ul>{!section.items.length?<p className="mt-3 text-penny-muted">No records on this page.</p>:null}{section.hasMore?<p className="mt-3 text-sm text-penny-muted">More {section.label.toLowerCase()} on the next page.</p>:null}</section>)}
 <nav aria-label="Person activity pages" className="flex flex-wrap items-center gap-5 text-sm"><p>Page {person.page} · Up to {person.pageSize} records in each section</p>{person.page>1?<WorkspaceLink className={textLinkClass} href={`${personHref(person.id)}?page=${person.page-1}`}>Previous page</WorkspaceLink>:null}{person.sections.some(section=>section.hasMore)?<WorkspaceLink className={textLinkClass} href={`${personHref(person.id)}?page=${person.page+1}`}>Next page</WorkspaceLink>:null}</nav>
 </div><aside className={`${paperCardClass} h-fit min-w-0 p-5`}>{person.mergedIntoId?<p className="text-sm text-penny-muted">Manage the surviving identity from its person page.</p>:<PersonActions person={person} onSaved={reload}/>}</aside></div></>
}
