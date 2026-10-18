import {useState} from 'react'
import {Link} from '@tanstack/react-router'
import {Chip} from '@/core/ui/app/Chip'
import {disclosureSummaryClass,secondaryButtonClass,textLinkClass} from '@/core/ui/app/classes'

export interface RequestVoter {
 id:string;displayName:string;votedAt:string;supporterType:'proxy'|'unmarked'|null
 importance?:number|null;nativeProxy?:number;proxyAttributionsJson?:string
 email:string|null;accountId:string|null;accountSlug:string|null;accountName:string|null
}
const pageSize=50

// Address/account joins may produce several rows for one person. Keep every
// association while presenting each vote once, including historical proxies.
export function RequestSupporters({voters}:{voters:readonly RequestVoter[]}){
 const [visible,setVisible]=useState(pageSize)
 const people=new Map<string,{voter:RequestVoter;emails:Set<string>;accounts:Map<string,{slug:string;name:string}>}>()
 for(const voter of voters){
  let person=people.get(voter.id)
  if(!person){person={voter,emails:new Set(),accounts:new Map()};people.set(voter.id,person)}
  if(voter.email)person.emails.add(voter.email)
  if(voter.accountId&&voter.accountSlug&&voter.accountName)person.accounts.set(voter.accountId,{slug:voter.accountSlug,name:voter.accountName})
 }
 if(!people.size)return null
 return <details className="group mt-5 border-t border-penny-line pt-1">
  <summary className={disclosureSummaryClass}>Supporters ({people.size})</summary>
  <ul className="mt-3 max-w-3xl divide-y divide-penny-line text-sm" aria-label="Supporters">
   {[...people.values()].slice(0,visible).map(({voter,emails,accounts})=><li key={voter.id} className="min-w-0 space-y-2 py-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="min-w-0 break-words font-medium text-penny-ink">{voter.displayName}</span><time dateTime={voter.votedAt} className="text-penny-muted tabular-nums">{voter.votedAt.slice(0,10)}</time></div>
    {emails.size?<ul aria-label="Verified addresses">{[...emails].map(email=><li key={email} className="break-all text-penny-muted">{email}</li>)}</ul>:<p className="text-penny-muted">No verified address</p>}
    {accounts.size?<ul aria-label="Linked accounts">{[...accounts.entries()].map(([id,account])=><li key={id}><Link className={`${textLinkClass} inline-flex min-h-11 items-center break-words`} to="/app/customers/$accountSlug" params={{accountSlug:account.slug}}>{account.name}</Link></li>)}</ul>:<p className="text-penny-muted">No linked account</p>}
    {voter.nativeProxy?<Chip tone="sand">Proxy vote</Chip>:null}
    {voter.proxyAttributionsJson?(JSON.parse(voter.proxyAttributionsJson) as {recorderId:string;recorderName:string;source:string;sourceUrl:string|null;evidenceId:string|null;recordedAt:string;directVoteAt:string|null}[]).map((attribution,index)=><p key={index} className="break-words text-sm leading-6 text-penny-muted">Recorded by {attribution.recorderName} · {attribution.source}{attribution.sourceUrl?<> · <a className={textLinkClass} href={attribution.sourceUrl} target="_blank" rel="noreferrer">Original source</a></>:null}{attribution.directVoteAt?' · Customer has since voted directly.':null}</p>):null}
    {voter.supporterType==='proxy'?<Chip tone="sand">Proxy, entered by a UserVoice admin</Chip>:voter.supporterType==='unmarked'?<Chip tone="muted">UserVoice, not marked as proxy</Chip>:null}
   </li>)}
  </ul>
  {people.size>visible?<button type="button" className={`${secondaryButtonClass} mt-3`} onClick={()=>setVisible(value=>value+pageSize)}>Show more supporters ({people.size-visible} remaining)</button>:null}
  {voters.some(voter=>voter.supporterType)?<p className="mt-2 text-sm leading-6 text-penny-muted">Imported supporters are historical attributions. They cannot sign in and are never contacted.</p>:null}
 </details>
}
