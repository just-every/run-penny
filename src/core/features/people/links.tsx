import {WorkspaceLink} from '../workspace/ui/workspace-link'
import {textLinkClass} from '@/core/ui/app/classes'
import {personHref} from './types'
export function PersonLink({id,children}:{id:string;children:React.ReactNode}){return <WorkspaceLink href={personHref(id)} className={textLinkClass}>{children}</WorkspaceLink>}
export function AccountPeopleLinks({people}:{people:readonly {id:string;displayName:string}[]}){return people.length?<nav aria-label="Person profiles" className="mb-4 rounded-xl border border-penny-line bg-penny-card p-5"><h2 className="font-bold">Person profiles</h2><ul className="mt-3 space-y-3">{people.map(p=><li className="break-words" key={p.id}><PersonLink id={p.id}>{p.displayName}</PersonLink></li>)}</ul></nav>:null}
