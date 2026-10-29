import {useEffect,useState} from 'react'
import {paperCardClass,primaryButtonClass,secondaryButtonClass,inputClass,fieldLabelClass,textLinkClass} from '@/core/ui/app/classes'
import {api,screenshotFile,upload,type Draft,type Job} from './client'
import {SearchPicker,SourceCheck} from './capture-page'

export function CaptureReview({draft,onSaved,onDiscard}:{draft:Draft;onSaved:()=>void;onDiscard:()=>void}){
 const [pageUrl,setPageUrl]=useState(draft.pageUrl),[observedAt,setObservedAt]=useState(draft.observedAt),[wording]=useState(draft.wording),[speaker,setSpeaker]=useState(''),[image,setImage]=useState(draft.image),[customer,setCustomer]=useState(''),[request,setRequest]=useState(''),[vote,setVote]=useState(false),[purgeDays,setPurgeDays]=useState(30),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[job,setJob]=useState<Job|null>(null),[locked,setLocked]=useState(false)
 useEffect(()=>{
  if(draft.mode!=='capture')return
  let active=true
  void fetch('/api/operator/browser-captures/'+draft.id,{cache:'no-store'}).then(async response=>{
   if(response.status===404)return
   if(!response.ok)throw Error('Penny could not check for an existing capture. Check your session before retrying.')
   const saved=await response.json() as Job
   if(active){setJob(saved);setLocked(true);setPageUrl(saved.page_url);if(!saved.screenshot_hash)setImage(undefined);setMessage('This capture already has a saved checkpoint. Resume uses its saved customer, request and vote choices.')}
  }).catch(error=>{if(active)setMessage(error.message)})
  return ()=>{active=false}
 },[draft.id,draft.mode])
 if(draft.mode==='check')return <SourceCheck draft={draft} onSaved={onSaved}/>
 async function save(){
  setBusy(true);setMessage('')
  try{
   const screenshot=await screenshotFile(image)
   let current=job??await api<Job>('/api/operator/browser-captures',{id:draft.id,pageUrl,wording,observedAt,...(speaker?{namedSpeaker:speaker}:{}),...(customer?{requesterId:customer}:{}),...(request?{requestId:request}:{}),proxyVote:vote,purgeDays,...(screenshot?{screenshot:{hash:screenshot.hash,bytes:screenshot.bytes}}:{})})
   setJob(current);setLocked(true)
   if(!['done','pending','running','stopped'].includes(current.state)){
    if(current.screenshot_hash&&screenshot)await upload(current.id,screenshot.file)
    current=await api<Job>(`/api/operator/browser-captures/${current.id}/ready`,{})
   }
   setJob(current);setMessage(current.state==='done'?'Capture completed.':'Saved to the inbox. Completion is queued; refresh progress to confirm.');onSaved()
  }catch(error){setMessage((error as Error).message);onSaved()}finally{setBusy(false)}
 }
 return <section aria-label="Review browser capture" className={`${paperCardClass} p-5 sm:p-7`}>
  <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-penny-muted">Private evidence · Review before saving</p><h2 className="mt-2 text-2xl font-semibold">Capture from your browser</h2></div><button className={secondaryButtonClass} disabled={busy} onClick={onDiscard}>Discard review</button></div>
  <p className="mt-4 break-all text-sm">Source: <a className={textLinkClass} href={draft.pageUrl} target="_blank" rel="noreferrer">{draft.pageUrl}</a></p><p className="mt-1 text-sm text-penny-muted">Captured <time dateTime={draft.observedAt}>{draft.observedAt}</time>. Review the source URL for private values before saving.</p>
  {locked&&job?<p role="status" className="mt-4 leading-7">Saved choices: {job.requester_name??'No customer'} · {job.request_title??'No request'} · {job.proxy_vote?'Proxy vote requested':'No proxy vote'}. The saved excerpt and choices are kept on resume.</p>:null}
  <form className="mt-6" onSubmit={event=>{event.preventDefault();void save()}}>
   <fieldset disabled={busy||locked} className="grid min-w-0 gap-7 lg:grid-cols-2"><div className="min-w-0 space-y-5"><label className={fieldLabelClass}>Original page URL<input type="url" required maxLength={4096} className={`${inputClass} mt-2`} value={pageUrl} onChange={event=>setPageUrl(event.target.value)}/></label><label className={fieldLabelClass}>Source time (ISO date, time and timezone)<input required className={`${inputClass} mt-2`} value={observedAt} onChange={event=>setObservedAt(event.target.value)}/></label><p className="text-sm text-penny-muted">Use the source’s own time when known. The capture time is prefilled.</p><label className={fieldLabelClass}>Selected excerpt<textarea aria-label="Selected excerpt" rows={7} maxLength={20000} className={`${inputClass} mt-2`} value={wording} readOnly/></label><label className={fieldLabelClass}>Author as named at the source (optional)<input maxLength={200} className={`${inputClass} mt-2`} value={speaker} onChange={event=>setSpeaker(event.target.value)}/></label>
    {image?<figure className="space-y-3"><img className="max-h-72 w-full rounded-lg border border-penny-line object-contain object-top" src={image} alt="Visible source tab selected for private attachment"/><figcaption className="text-sm leading-6">Review the image for private information. Text redaction applies to the excerpt and source labels; binary screenshots keep their original bytes.</figcaption><button type="button" className={secondaryButtonClass} onClick={()=>setImage(undefined)}>Remove screenshot</button></figure>:<p className="text-sm text-penny-muted">No screenshot will be attached.</p>}
   </div><div className="min-w-0 space-y-5"><SearchPicker kind="customer" value={customer} onChange={value=>{setCustomer(value);setVote(false)}}/><SearchPicker kind="request" value={request} onChange={value=>{setRequest(value);setVote(false)}}/><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={vote} disabled={!customer||!request||!wording.trim()} onChange={event=>setVote(event.target.checked)}/>Record a proxy vote from this excerpt</label><p className="text-sm leading-6 text-penny-muted">Optional customer and request choices stay private. A proxy vote counts once, names you as recorder and creates no verified identity or email subscription.</p><label className={fieldLabelClass}>Days to keep the excerpt after source removal<input type="number" min={0} max={365} required value={purgeDays} onChange={event=>setPurgeDays(Number(event.target.value))} className={`${inputClass} mt-2`}/></label><p className="text-sm text-penny-muted">Only the workspace owner can change the default 30-day retention window.</p></div></fieldset>
   <div className="mt-6 flex flex-wrap gap-3 border-t border-penny-line pt-5"><button disabled={busy||job?.state==='done'||job?.state==='stopped'} className={primaryButtonClass}>{busy?'Saving…':locked?'Resume capture':'Save to inbox'}</button>{job?<><a className={`${textLinkClass} inline-flex min-h-11 items-center`} href={`/app/feedback?item=${job.evidence_id}#evidence-${job.evidence_id}`}>Open captured evidence</a><button type="button" disabled={busy} className={secondaryButtonClass} onClick={async()=>{try{const result=await api<Job>(`/api/operator/browser-captures/${job.id}`);setJob(result);setMessage(result.state==='done'?'Capture completed.':result.failure??'Capture: '+result.state);onSaved()}catch(error){setMessage((error as Error).message)}}}>Check completion</button></>:null}</div>
   {message?<p role="status" className="mt-4 break-words leading-7">{message}</p>:null}
  </form>
 </section>
}
