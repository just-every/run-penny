import {hostRequesterName} from '@/core/features/auth/host-client'
import { RequestSuggestions } from './request-suggestions'
import { useEffect,useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { PublicBoard } from '@/core/shared/api/public'
import { postJson, requesterStorageKey, requesterHeaders } from '@/core/features/auth/client-mutations'
import { buttonClass, fieldClass, fieldLabelClass, textLinkClass } from '@/core/features/portal/ui/portal-classes'
import type { PublicPortalContent } from './public-portal-layout'
import { PublicPortalLayout } from './public-portal-layout'
import { PublicCard } from './public-primitives'
import { PageTitle } from '@/core/ui/app/PageTitle'
import { usePublicResource } from './public-resource'
const h2Class='text-xl font-bold tracking-[-0.02em] text-penny-ink'
export function SubmitFeedbackPage({content}:{readonly content:PublicPortalContent}){
  const [capabilities]=usePublicResource<{transport:string}>('/api/auth/capabilities')
  const ready=capabilities.kind==='ready'&&capabilities.data.transport!=='unavailable'
  const [boards]=usePublicResource<PublicBoard[]>('/api/public/boards')
  const [identity,setIdentity]=useState<{token:string;displayName:string}|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[submitted,setSubmitted]=useState(false),[selected,setSelected]=useState<{slug:string;title:string;action:'vote'|'follow'}|null>(null)
  const [title,setTitle]=useState('')
  const [key,setKey]=useState(()=>crypto.randomUUID())
  useEffect(()=>{const token=localStorage.getItem(requesterStorageKey);if(token)void fetch('/api/public/identity/session',{headers:{Authorization:`Bearer ${token}`}}).then(async response=>{if(response.ok)setIdentity({token,...await response.json() as {displayName:string}});else localStorage.removeItem(requesterStorageKey)}).catch(()=>setMessage('Could not validate your session. Please retry.'))},[])
  useEffect(()=>{const changed=()=>{const name=hostRequesterName();setIdentity(name?{token:'',displayName:name}:null)};changed();window.addEventListener('penny-requester-changed',changed);return ()=>window.removeEventListener('penny-requester-changed',changed)},[])
  return <PublicPortalLayout content={content}><div className="mx-auto max-w-2xl py-2 sm:py-6">
    <PageTitle id="submit-heading" eyebrow="Feedback">Submit feedback</PageTitle>
    {!ready?<p role="status" className="mt-5 text-sm text-penny-ink">{identity?'Email delivery is not configured. You can submit feedback with your verified session.':'Email verification is temporarily unavailable. You can browse published feedback; new visitors need verification before submitting.'}</p>:null}
    <PublicCard className="mt-8 p-5 sm:p-7">
      {selected?<><h2 className={h2Class}>{selected.action==='vote'?'Vote saved':'Following feedback'}</h2><p className="mt-3 leading-7 text-penny-ink">{selected.action==='vote'?'Your vote was added to':'You are following'} {selected.title}. No new feedback was submitted.</p><Link to="/portal/feedback/$requestSlug" params={{requestSlug:selected.slug}} className={`${textLinkClass} mt-4 flex min-h-11 w-fit items-center`}>View existing feedback</Link><button type="button" className={`${buttonClass} mt-2`} onClick={()=>{setSelected(null);setMessage('')}}>Start a new request</button></>:submitted?<><h2 className={h2Class}>Feedback is awaiting review</h2><p className="mt-3 leading-7 text-penny-ink">Your feedback and its original evidence were saved. An operator must approve customer-safe wording before it appears publicly.</p><Link to="/portal/feedback/activity" className={`${textLinkClass} mt-4 flex min-h-11 w-fit items-center`}>Your feedback</Link><button className={`${buttonClass} mt-2`} onClick={()=>{setSubmitted(false);setKey(crypto.randomUUID());setMessage('')}}>Submit another request</button></>:identity?<>
        <p className="text-sm text-penny-muted">Verified as {identity.displayName}. Submission grants no email update permission.</p>
        <form className="mt-5 space-y-5" onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setMessage('');try{const result=await postJson<{slug:string}>('/api/public/requests',{title:data.get('title'),description:data.get('description'),boardSlug:data.get('board'),proposedSolution:data.get('solution'),impactStatement:data.get('impact'),idempotencyKey:key,emailUpdates:data.get('updates')==='on'},identity.token);const file=data.get('attachment');if(file instanceof File && file.size){const upload=new FormData();upload.set('file',file);const response=await fetch(`/api/public/requests/${result.slug}/attachments`,{method:'POST',headers:requesterHeaders(),body:upload});if(!response.ok)throw new Error('Feedback saved, but attachment upload failed. Open Your feedback to review it.')}setSubmitted(true)}catch(error){setMessage(error instanceof Error?error.message:'Submission failed.')}finally{setBusy(false)}}}>
          <label className={fieldLabelClass}>Title<input name="title" value={title} onChange={e=>setTitle(e.target.value)} className={fieldClass} required maxLength={200}/></label>
          {title.trim().length>=2?<RequestSuggestions title={title} onSelected={(suggestion,action)=>{setSelected({slug:suggestion.slug,title:suggestion.title,action});setTitle('');setMessage('')}}/>:null}
          <label className={fieldLabelClass}>Problem description<textarea name="description" className={fieldClass} rows={5} required maxLength={10000}/></label>
          <label className={fieldLabelClass}>Board<select name="board" className={fieldClass} required defaultValue=""><option value="" disabled>Select a board</option>{boards.kind==='ready'?boards.data.map(board=><option key={board.slug} value={board.slug}>{board.name}</option>):null}</select></label>
          <label className={fieldLabelClass}>Proposed solution (optional)<textarea name="solution" className={fieldClass} rows={2} maxLength={5000}/></label>
          <label className={fieldLabelClass}>Impact (optional)<textarea name="impact" className={fieldClass} rows={2} maxLength={5000}/></label>
          <label className={fieldLabelClass}>Attachment (optional)<input name="attachment" type="file" accept="image/png,image/jpeg,image/gif,application/pdf" className={fieldClass}/></label><p className="text-sm text-penny-muted">Attachments stay private until approved. Maximum 10 MB.</p><label className="flex min-h-11 items-center gap-2 text-sm text-penny-ink"><input name="updates" type="checkbox" className="size-4 accent-penny-ink"/>Email me updates</label>
          <button className={buttonClass} disabled={busy||boards.kind!=='ready'||!key}>{busy?'Saving…':'Send for review'}</button>
        </form></>:<>
        <h2 className={h2Class}>Verify your email first</h2><p className="mt-3 leading-7 text-penny-ink">A single-use verification link identifies your feedback. Your email stays private; an operator approves your display name before publication.</p>
        <form className="mt-5 space-y-5" onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);try{await postJson('/api/public/identity/email',{email:data.get('email'),displayName:data.get('displayName')});setMessage('Check your email for a verification link; it expires after 30 minutes.')}catch(error){setMessage(error instanceof Error?error.message:'Verification failed.')}finally{setBusy(false)}}}>
          <label className={fieldLabelClass}>Display name<input name="displayName" className={fieldClass} required maxLength={160}/></label><label className={fieldLabelClass}>Email<input name="email" type="email" autoComplete="email" className={fieldClass} required maxLength={254}/></label><button className={buttonClass} disabled={!ready||busy}>{busy?'Requesting…':'Send verification link'}</button>
        </form></>}
      <p role="status" className="mt-4 text-sm leading-6 text-penny-ink">{message}</p>
    </PublicCard><Link to="/portal/feedback" className={`${textLinkClass} mt-6 inline-flex min-h-11 items-center`}>Browse published feedback</Link>
  </div></PublicPortalLayout>
}
