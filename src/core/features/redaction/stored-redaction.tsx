import {useEffect,useState} from 'react'
import {useHydrated} from '@/core/app/ui/hydrated'
import {buttonClass} from '../auth/client-mutations'
import {operatorMutation} from '../requests/ui/operator-client'
import {disclosureSummaryClass,textLinkClass} from '@/core/ui/app/classes'
import {activeRun,errorMessage,recordCount,type RedactionRun} from './run-view'

const root='/api/operator/settings/redaction'
export function StoredRedaction({run,setRun,enabled,saving}:{run:RedactionRun|null;setRun:(run:RedactionRun)=>void;enabled:boolean;saving:boolean}){
 const hydrated=useHydrated()
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmedPlan,setConfirmedPlan]=useState<string|null>(null),[refresh,setRefresh]=useState(0)
 const runId=run?.id,runState=run?.state,confirmed=!!run?.planHash&&confirmedPlan===run.planHash
 const places=run?.places??[],changing=places.filter(place=>!place.blocked&&Number(place.changes)>0),unchanged=places.filter(place=>place.blocked||!place.changes)
 useEffect(()=>{
  if(!runId||!['previewing','running','ready'].includes(runState??''))return
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>
  async function poll(){
   try{const response=await fetch(`${root}/runs/${runId}`,{signal:controller.signal});if(!response.ok)throw new Error('Could not refresh redaction progress.');const next=await response.json() as RedactionRun;if(!controller.signal.aborted){setRun(next);setError('');if(activeRun(next)||next.state==='ready')timer=setTimeout(poll,1000)}}
   catch(cause){if(!controller.signal.aborted)setError(errorMessage(cause,'Could not refresh redaction progress.'))}
  }
  timer=setTimeout(poll,1000)
  return ()=>{controller.abort();clearTimeout(timer)}
 },[runId,runState,setRun,refresh])
 async function start(path:string,input:Record<string,unknown>){
  setBusy(true);setError('')
  try{setRun(await operatorMutation(root+path,input) as RedactionRun);setConfirmedPlan(null)}catch(cause){
   setError(errorMessage(cause,'Could not start redaction.'))
   if(runId){const response=await fetch(`${root}/runs/${runId}`);if(response.ok){const next=await response.json() as RedactionRun;setRun(next);if(next.state==='stale')setError('')}}
  }finally{setBusy(false)}
 }
 const previewButton=<button type="button" className={buttonClass} disabled={busy||saving||!enabled||activeRun(run)||!hydrated} onClick={()=>void start('/preview',{})}>{run?'Preview again':'Preview stored evidence redaction'}</button>
 return <div className="mt-6 space-y-4">
  <h3 className="font-bold">Stored captures</h3>
  {!run?<><p>{enabled?'Preview matches before redacting stored captures.':'Enable redaction to preview stored captures.'}</p>{previewButton}</>:null}
  {run?<div className="space-y-4" aria-label="Stored redaction progress" data-redaction-state={run.state}>
   <p role="status">{run.state==='previewing'?`Previewing stored text: ${recordCount(run.scanned)} scanned.`:run.state==='ready'?`${recordCount(run.records)} checked; ${run.changes} will change.`:run.state==='running'?`Redacting stored text: ${recordCount(run.changed)} changed; ${run.scanned} scanned.`:run.state==='complete'?`Redaction complete: ${recordCount(run.changed)} changed.`:run.state==='stale'?'Rules or stored text changed since this preview.':'Redaction stopped. Progress is saved.'}</p>
   {activeRun(run)?<progress className="w-full" aria-label={run.state==='previewing'?'Preview progress':'Redaction progress'} max={Math.max(1,run.records)} value={run.scanned} />:null}
   {run.state==='ready'?<>
    {changing.length?<PlaceRows places={changing} changes/>:null}
    {unchanged.length?<details className="group" data-redaction-unchanged><summary className={disclosureSummaryClass}>{unchanged.length} places keep their text</summary><div className="mt-3 space-y-4">
     <PlaceRows places={unchanged.filter(place=>!place.blocked)}/>
     {[...new Set(unchanged.filter(place=>place.blocked).map(place=>place.reason))].map(reason=><div key={reason}><h4 className="font-bold">{reason?.startsWith('Sealed')?'Sealed copies':reason?.startsWith('Canonical')?'Canonical addresses':'Preserved history'}</h4><PlaceRows places={unchanged.filter(place=>place.blocked&&place.reason===reason)}/></div>)}
     <p>Manage preserved text in <a className={textLinkClass} href="/app/data">Data</a>. Binary originals stay unchanged.</p>
    </div></details>:null}
    {run.planHash&&run.changes>0?<form className="space-y-3" aria-label="Confirm stored redaction" onSubmit={event=>{event.preventDefault();if(confirmed)void start('/reapply',{planHash:run.planHash,confirmIrreversible:true})}}>
     <label className="flex min-h-11 items-center gap-2"><input type="checkbox" required checked={confirmed} onChange={event=>setConfirmedPlan(event.target.checked?run.planHash:null)}/>I understand this permanently removes the matched wording.</label>
     <button className={buttonClass} disabled={busy||saving||!confirmed||!hydrated}>Redact stored evidence permanently</button>
    </form>:null}
   </>:null}
   {run.state==='stale'||run.state==='complete'||run.state==='ready'||(run.state==='failed'&&!run.canResume)?previewButton:null}
   {run.state==='failed'&&run.canResume?<button type="button" className={buttonClass} disabled={busy||saving||!hydrated} onClick={()=>void start(`/runs/${run.id}/resume`,{})}>Resume redaction</button>:null}
   {error?<><p role="alert">{error}</p>{activeRun(run)?<button type="button" className={buttonClass} onClick={()=>{setError('');setRefresh(value=>value+1)}}>Refresh progress</button>:null}</>:null}
  </div>:null}
  {!run&&error?<p role="alert">{error}</p>:null}
 </div>
}

function PlaceRows({places,changes=false}:{places:RedactionRun['places'];changes?:boolean}){
 if(!places.length)return null
 return <ul className="space-y-2" aria-label="Stored text places">{places.map(place=><li key={place.table} className="min-w-0 break-words text-sm" data-redaction-place={place.table} data-records={place.records} data-changes={place.changes??''} data-blocked={place.blocked}><span className="font-semibold">{place.label}</span>{': '}{changes?`${recordCount(place.changes!)} will change`:recordCount(place.records)}</li>)}</ul>
}
