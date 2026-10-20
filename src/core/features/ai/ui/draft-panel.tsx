import {useState} from 'react'
import {operatorMutation} from '../../requests/ui/operator-client'
import {fieldClass} from '../../auth/client-mutations'
import {disclosureSummaryClass,fieldLabelClass,primaryButtonClass,textLinkClass} from '@/core/ui/app/classes'
import type {DraftKind} from '../draft-context'
interface Draft {task:'summary'|'reply';text:string;paragraphs:{text:string;citationIds:string[]}[];citations:{id:string;label:string;href:string}[];flags:string[];notices:string[];replyTargets:{slug:string;title:string}[];costMicros:number}
export function DraftPanel({kind,id,onSent}:{kind:DraftKind;id:string;onSent?:()=>void}){
 const reply=kind==='comment'||kind==='inbox',label=reply?'Reply draft':'Evidence summary', [draft,setDraft]=useState<Draft|null>(null),[text,setText]=useState(''),[target,setTarget]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function generate(){setBusy(true);setMessage('');try{const d=await operatorMutation('/api/operator/ai/drafts',{kind,id}) as Draft;setDraft(d);setText(d.text);setTarget(d.replyTargets[0]?.slug??'')}catch(e){setMessage(e instanceof Error?e.message:'Draft unavailable.')}finally{setBusy(false)}}
 async function send(){setBusy(true);setMessage('');try{await operatorMutation(`/api/operator/requests/${target}/comments`,{body:text,aiDraft:true});setMessage('Reply posted to the published request.');setDraft(null);setText('');onSent?.()}catch(e){setMessage(e instanceof Error?e.message:'Reply could not be posted.')}finally{setBusy(false)}}
 return <details className="group my-5 min-w-0 rounded-xl border border-penny-line bg-penny-paper p-4" data-draft-kind={kind} data-draft-id={id}>
  <summary className={disclosureSummaryClass}>{label}</summary>
  <section aria-label={`${label} editor`} className="min-w-0 space-y-4 pt-3">
   <p className="text-sm leading-6 text-penny-muted">Drafts use the records you can access. Private notes and commercial fields are withheld unless the owner enables private context in AI settings. Nothing is sent automatically.</p>
   <button type="button" className={primaryButtonClass} disabled={busy} onClick={()=>void generate()}>{busy?'Working…':`Draft ${reply?'reply':'summary'}`}</button>
   {message?<p role="status" className="break-words text-sm font-semibold text-penny-ink">{message}</p>:null}
   {draft?<>
    {draft.notices.map(n=><p key={n} role="status" className="break-words text-sm text-penny-ink">{n}</p>)}
    {draft.flags.length?<p role="alert" className="rounded-lg border border-penny-copper p-3 text-sm font-semibold text-penny-ink">Private values detected: {draft.flags.join(', ')}. Remove them before publishing; the send path checks the edited wording again.</p>:null}
    <label className={fieldLabelClass}>Edit {reply?'reply':'summary'}<textarea className={`${fieldClass} min-h-40 w-full`} value={text} onChange={e=>setText(e.target.value)} /></label>
    <div><h4 className="font-bold text-penny-ink">Verified supporting records</h4><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">{draft.citations.map((c,index)=><li key={c.id}><a className={`${textLinkClass} inline-flex min-h-11 items-center break-words`} href={c.href}>{c.label} {index+1}</a></li>)}</ol></div>
    <p className="text-sm text-penny-muted">Metered cost: ${(draft.costMicros/1000000).toFixed(6)}. Supporting links stay in this private editor.</p>
    {reply?draft.replyTargets.length?<>
     <label className={fieldLabelClass}>Post reply to<select className={fieldClass} value={target} onChange={e=>setTarget(e.target.value)}>{draft.replyTargets.map(r=><option key={r.slug} value={r.slug}>{r.title}</option>)}</select></label>
     <p className="text-sm text-penny-muted">This posts your edited wording as a public operator comment through the existing request discussion. Check the audience and remove private details first.</p>
     <button type="button" className={primaryButtonClass} disabled={busy||!text.trim()||!target} onClick={()=>void send()}>Post public reply</button>
    </>:<p className="text-sm text-penny-muted">Link this evidence to a published public request to post a reply through its discussion. You can keep editing this draft here.</p>:null}
   </>:null}
  </section>
 </details>
}
