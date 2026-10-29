import {useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {SectionCard} from '@/core/ui/app/SectionCard'
import {operatorMutation} from '../requests/ui/operator-client'
import {buttonClass,fieldClass} from '../auth/client-mutations'
import {fieldLabelClass} from '@/core/ui/app/classes'
import {reviewFailureHint} from './failure-hint'
import {siteLabels as labels} from './types'
interface Status {canConfigure:boolean;configured:boolean;connections:{id:string;site:keyof typeof labels;listing:string;ownerName:string|null;state:string;last_success:string|null;next_due:string;interval_hours:number;captured:number;cursor:string|null;backlog:number;failure:string|null;hasCredential:number}[]}
const path='/api/operator/integrations/reviews'
export function ReviewSettings(){
 const [resource,reload]=useOperatorResource<Status>(path),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 async function save(body:unknown,suffix=''){setBusy(true);try{await operatorMutation(path+suffix,body,'POST');setMessage('Review settings saved.');reload();return true}catch(error){setMessage(error instanceof Error?error.message:'Review settings could not be saved.');return false}finally{setBusy(false)}}
 return <SectionCard id="review-capture" icon="evidence" title="Review capture" description="Bring reviews from selected product listings into the private feedback inbox.">
 {resource.kind==='ready'&&resource.data.canConfigure?<div className="space-y-5">
 <p>{resource.data.configured?'Review transport configured.':'Review capture is unavailable until the installation owner configures its enforcing transport.'}</p>
 <p>Reviews are read daily by default. Reviewers remain source names only and are never emailed. AI suggests requests for operator review; it publishes nothing.</p>
 <form className="space-y-5" onSubmit={event=>{event.preventDefault();const form=event.currentTarget,v=new FormData(form);let credential:unknown;try{credential=v.get('credential')?JSON.parse(String(v.get('credential'))):undefined}catch{setMessage('Enter valid credential JSON before connecting.');return}void save({site:String(v.get('site')),listing:String(v.get('listing')),publicUrl:String(v.get('publicUrl')||'')||null,termsAccepted:v.get('terms')==='on',intervalHours:Number(v.get('interval')),purgeDays:Number(v.get('purge')),extract:v.get('extract')==='on',...(v.get('token')?{token:String(v.get('token'))}:{}),...(credential?{credential}:{})}).then(ok=>{if(ok){(form.elements.namedItem('token') as HTMLInputElement).value='';(form.elements.namedItem('credential') as HTMLTextAreaElement).value=''}})}}>
 <div className="grid gap-5 sm:grid-cols-2">
 <label className={fieldLabelClass}>Review site<select className={fieldClass} name="site">{Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
 <label className={fieldLabelClass}>Product listing ID<input required name="listing" className={fieldClass} maxLength={160}/></label>
 </div>
 <label className={fieldLabelClass}>Vendor access token<input type="password" name="token" autoComplete="new-password" className={fieldClass} aria-describedby="review-token-help"/></label><p id="review-token-help" className="text-sm text-penny-muted">Use a credential scoped to this listing. It is encrypted in this installation, omitted from exports and deleted on disconnect. Leave blank to keep a saved credential. Capterra and TrustRadius use the public page instead.</p>
 <details className="group"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Renewable vendor credentials</summary><p className="text-sm text-penny-muted">For daily sync, use an App Store signing key, Google Play service account, or Trustpilot refresh credential. Follow the <a className="underline" href="https://github.com/just-every/run-penny/blob/main/docs/REVIEWS.md" target="_blank" rel="noreferrer">installation guide</a> for the JSON fields. Leave the access token blank when using this option.</p><label className={fieldLabelClass}>Vendor credential JSON<textarea name="credential" rows={4} className={fieldClass} spellCheck={false} autoComplete="off"/></label></details>
 <label className={fieldLabelClass}>Public review page URL<input name="publicUrl" type="url" className={fieldClass}/></label>
 <label className="flex min-h-11 items-center gap-3"><input name="terms" type="checkbox"/>I have checked that the public listing’s terms permit these scheduled reads.</label>
 <div className="grid gap-5 sm:grid-cols-2">
 <label className={fieldLabelClass}>Hours between syncs<input name="interval" type="number" min={1} max={168} defaultValue={24} required className={fieldClass}/></label>
 <label className={fieldLabelClass}>Days to retain removed excerpts<input name="purge" type="number" min={0} max={365} defaultValue={0} required className={fieldClass}/></label>
 </div><p className="text-sm text-penny-muted">Google Play exposes a rolling week of reviews: keep the interval at one week or less. Saving makes you accountable for the listing and restarts its scan. Public pages must expose review JSON-LD; unavailable markup is a visible failure.</p>
 <label className="flex min-h-11 items-center gap-3"><input name="extract" type="checkbox" defaultChecked/>Propose requests from review text using my configured AI model and budget</label>
 <button className={buttonClass} disabled={busy||!resource.data.configured}>Connect review listing</button>
 </form>
 <div className="border-t border-penny-line pt-5"><h3 className="font-semibold">Connected listings</h3><button className={buttonClass+' mt-3'} type="button" onClick={reload}>Refresh review progress</button>
 <ul aria-label="Review connector progress" className="mt-4 space-y-4">{resource.data.connections.map(c=><li className="rounded-lg border border-penny-line p-4 break-words" key={c.id}>
 <h4 className="font-semibold">{labels[c.site]} · {c.listing}</h4><p>Accountable owner: {c.ownerName??'Removed owner'}</p><p>{c.state} · {c.captured} captured · {c.backlog} awaiting extraction</p><p>Last complete sync: {c.last_success??'None yet'}</p><p>Next due: {c.next_due} · every {c.interval_hours} hours</p>{c.cursor?<p>A scan is in progress; its page checkpoint is saved.</p>:null}{c.failure?<p role="status">{reviewFailureHint(c.failure)}</p>:null}
 {!['disconnected','held'].includes(c.state)?<div className="mt-3 flex flex-wrap gap-3">{['paused','held'].includes(c.state)?<button className={buttonClass} disabled={busy} onClick={()=>void save({id:c.id,action:'resume'},'/actions')}>Resume reviews</button>:<button className={buttonClass} disabled={busy} onClick={()=>void save({id:c.id,action:'pause'},'/actions')}>Pause reviews</button>}<button className={buttonClass} disabled={busy} onClick={()=>void save({id:c.id,action:'retry'},'/actions')}>Retry sync and source checks</button><button className={buttonClass} disabled={busy} onClick={()=>void save({id:c.id,action:'disconnect'},'/actions')}>Disconnect reviews</button></div>:<p>Reconnect this listing above to capture again.</p>}
 {c.state==='scheduled'?<form className="mt-4 space-y-3" onSubmit={event=>{event.preventDefault();void save({id:c.id,action:'retry-extraction',acknowledgePaidRetry:true},'/actions')}}><label className="flex min-h-11 items-center gap-3"><input type="checkbox" required/>I checked failed extraction and provider usage. Retrying may incur another charge.</label><button className={buttonClass} disabled={busy}>Retry failed review extraction</button></form>:null}
 </li>)}</ul>{resource.data.connections.length===0?<p className="mt-3">No review listings connected.</p>:null}</div>
 </div>:<p role="status">{resource.kind==='loading'?'Loading review capture…':'Owner access is required to configure review capture.'}</p>}
 <p role="status" className="mt-4">{message}</p>
 </SectionCard>
}
