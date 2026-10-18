import { VoteImportanceControl } from './vote-importance-control'
import type {PublicBoard} from '@/core/shared/api/public'
import {usePublicResource} from '@/core/features/portal/ui/public-resource'
import { requesterMutation } from './requester-client'
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { requesterHeaders } from '@/core/features/auth/client-mutations'
import { buttonClass, fieldClass, accentLinkClass, fieldLabelClass, secondaryButtonClass } from '@/core/features/portal/ui/portal-classes'
import { PortalIcon } from '@/core/features/portal/ui/public-primitives'
import { rememberReturn } from '@/core/features/auth/requester-return'

export function RequesterActions({slug,onChange,compact=false,commentsAllowed=true,showVoters=false,onSelected}:{slug:string;onChange?:()=>void;compact?:boolean;commentsAllowed?:boolean;showVoters?:boolean;onSelected?:(action:'vote'|'follow')=>void}) {
  const [request]=usePublicResource<{board:{slug:string};status:string}>(`/api/public/requests/${slug}`)
  const [boards]=usePublicResource<PublicBoard[]>('/api/public/boards')
  const disclosure=boards.kind==='ready'&&request.kind==='ready'?boards.data.find(b=>b.slug===request.data.board.slug)?.subscriptionDisclosure:undefined
  const importanceChoices=boards.kind==='ready'&&request.kind==='ready'?boards.data.find(b=>b.slug===request.data.board.slug)?.importanceChoices??[]:[]
  const [importance,setImportance]=useState('')
  const declined=request.kind==='ready'&&request.data.status==='declined'
  const votingClosed=request.kind==='ready'&&['declined','shipped'].includes(request.data.status)
  const [verified,setVerified]=useState(false),[voted,setVoted]=useState(false),[following,setFollowing]=useState(false)
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[updates,setUpdates]=useState(false)
  useEffect(()=>{
    let active=true
    const load=()=>{const headers=requesterHeaders();setVerified(false);if(!Object.keys(headers).length)return
      void fetch('/api/public/requester/activity',{headers}).then(async r=>{if(!r.ok)throw new Error('Session unavailable');const data=await r.json() as {votes:{slug:string;importance:number|null}[];follows:{slug:string}[]};if(active){setVerified(true);const vote=data.votes.find(v=>v.slug===slug);setVoted(Boolean(vote));setImportance(vote?.importance==null?'':String(vote.importance));setFollowing(data.follows.some(v=>v.slug===slug))}}).catch(()=>{if(active)setMessage('Verify your email to participate.')})
    }
    load();window.addEventListener('penny-requester-changed',load)
    return ()=>{active=false;window.removeEventListener('penny-requester-changed',load)}
  },[slug])
  async function act(kind:'vote'|'follow') {
    setBusy(true);setMessage('')
    try {const active=kind==='vote'?voted:following;await requesterMutation(`/api/public/requests/${slug}/${kind}`,active?'DELETE':'POST',active?undefined:kind==='vote'?{emailUpdates:updates,subscriptionVersion:disclosure?.version,...(importanceChoices.length?{importance:importance?Number(importance):null}:{})}:{})
      if(kind==='vote')setVoted(!active);else setFollowing(!active)
      // Adding or removing a vote can change automatic email permission.
      if(kind==='vote')window.dispatchEvent(new Event('penny-requester-changed'))
      setMessage(kind==='vote'?(active?'Vote removed.':'Vote saved.'):(active?'Unfollowed.':'Following with email permission.'));onChange?.();if(!active)onSelected?.(kind)
    }catch(e){setMessage(e instanceof Error?e.message:'Action failed.')}finally{setBusy(false)}
  }
  return <section className="mt-6 space-y-4" aria-label="Participate in feedback">
    {!verified?<p className="text-sm text-penny-ink"><Link to="/portal/feedback/new" onClick={()=>rememberReturn(`/portal/feedback/${slug}`)} className={`${accentLinkClass} inline-flex min-h-11 items-center`}>Verify your email</Link> to vote, follow or comment.</p>:null}
    {showVoters?<p className="text-sm text-penny-ink">Voter display names are listed publicly on this board. Anonymous boards display Anonymous.</p>:null}
    {declined?<p className="text-sm text-penny-ink">This request is declined. New votes and comments are closed; existing discussion stays visible.</p>:null}
    {votingClosed&&!declined?<p className="text-sm text-penny-ink">This request has shipped. New votes are closed.</p>:null}
    {!voted&&!votingClosed&&disclosure?.enabled?<p className="text-sm leading-6 text-penny-ink">{disclosure.vote}</p>:null}
    {verified?<VoteImportanceControl choices={importanceChoices} value={importance} onChange={setImportance} voted={voted} busy={busy} onSave={()=>{setBusy(true);setMessage('');void requesterMutation(`/api/public/requests/${slug}/vote-importance`,'PATCH',{importance:importance?Number(importance):null}).then(()=>{setMessage('Importance saved.');onChange?.()},error=>setMessage(error instanceof Error?error.message:'Could not save importance.')).finally(()=>setBusy(false))}}/>:null}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy||!verified||(!voted&&votingClosed)||request.kind!=='ready'||boards.kind!=='ready'} className={buttonClass} onClick={()=>void act('vote')}><PortalIcon name="vote" />{voted?'Remove vote':'Vote'}</button>
      <button type="button" disabled={busy||!verified} className={secondaryButtonClass} onClick={()=>void act('follow')}><PortalIcon name="bell" />{following?'Unfollow':'Follow'}</button>
    </div>
    {!voted&&!following?<label className="flex min-h-11 items-center gap-2 text-sm text-penny-ink"><input type="checkbox" className="size-4 accent-penny-ink" checked={updates} onChange={e=>setUpdates(e.target.checked)}/>Email me updates</label>:null}
    {verified&&(voted||following)?<p className="text-sm text-penny-muted">{following?'Email updates are on for this request.':'Email updates are off for this request. Follow it to get them.'}</p>:null}
    {!compact&&verified&&commentsAllowed&&!declined?<form className="space-y-3 border-t border-penny-line pt-5" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;setBusy(true);try{await requesterMutation(`/api/public/requests/${slug}/comments`,'POST',{body:new FormData(form).get('body')});form.reset();setMessage('Your comment is awaiting review.');onChange?.()}catch(error){setMessage(error instanceof Error?error.message:'Comment failed.')}finally{setBusy(false)}}}><label className={fieldLabelClass}>Add a comment<textarea required maxLength={20000} name="body" rows={3} className={fieldClass}/></label><button className={buttonClass} disabled={busy}>Send comment for review</button></form>:null}
    {!compact&&!commentsAllowed?<p className="text-sm text-penny-muted">Requester comments are disabled on this board.</p>:null}
    <p role="status" className="text-sm leading-6 text-penny-ink">{message}</p>
  </section>
}
