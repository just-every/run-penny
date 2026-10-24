import {useEffect,useRef,useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {SectionCard} from '@/core/ui/app/SectionCard'
import {operatorMutation} from '../requests/ui/operator-client'
import {buttonClass,fieldClass} from '../auth/client-mutations'
import {fieldLabelClass} from '@/core/ui/app/classes'
import {kinds,type Rules} from './engine'

const root='/api/operator/settings/redaction'
const labels={ssn:'US Social Security numbers',card:'Payment card numbers',phone:'Phone numbers',email:'Email addresses',credential:'Credential assignments'}
interface Run {
 id:string;state:'previewing'|'ready'|'running'|'complete'|'failed';records:number;changes:number;changed:number;scanned:number;planHash:string|null
 places:{table:string;label:string;records:number;changes:number|null;blocked:boolean;reason?:string}[];error:string|null
}
type Settings=Rules&{canConfigure:boolean;latestRun:Run|null}
const active=(run:Run|null)=>run?.state==='previewing'||run?.state==='running'
const message=(error:unknown,fallback:string)=>error instanceof Error?error.message:fallback
const records=(count:number)=>`${count} record${count===1?'':'s'}`

function RulesForm({initial,disabled,onChange,onSaving}:{initial:Rules;disabled:boolean;onChange:(rules:Rules)=>void;onSaving:(saving:boolean)=>void}){
 const [rules,setRules]=useState<Rules>(()=>({enabled:initial.enabled,kinds:initial.kinds,patterns:initial.patterns})),[patterns,setPatterns]=useState(initial.patterns.join('\n')),[status,setStatus]=useState(''),[failed,setFailed]=useState(false)
 const pending=useRef<Rules|null>(null),saving=useRef(false),current=useRef(rules),saved=useRef(rules)
 async function save(next:Rules){
  pending.current=next
  if(saving.current)return
  saving.current=true;onSaving(true);setFailed(false);setStatus('Saving…')
  try{
   while(pending.current){const value=pending.current;pending.current=null;await operatorMutation(root,value,'PUT');saved.current=value}
   const dirty=JSON.stringify(current.current)!==JSON.stringify(saved.current);setStatus(dirty?'Unsaved changes':'Saved');onSaving(dirty)
  }catch(error){pending.current=null;setFailed(true);setStatus(message(error,'Could not save redaction rules.'));onSaving(true)}
  finally{saving.current=false}
 }
 function update(next:Rules){current.current=next;setRules(next);onChange(next);void save(next)}
 return <form className="space-y-4" onSubmit={event=>event.preventDefault()}>
  <fieldset disabled={disabled} className="space-y-4">
   <label className="flex min-h-11 items-center gap-2"><input name="enabled" type="checkbox" checked={rules.enabled} onChange={event=>update({...current.current,enabled:event.target.checked})}/>Enable redaction for new captures</label>
   <fieldset className="space-y-2"><legend className="font-bold">Default kinds</legend>{kinds.map(kind=><label key={kind} className="flex min-h-11 items-center gap-2"><input name="kinds" value={kind} type="checkbox" checked={rules.kinds.includes(kind)} onChange={event=>update({...current.current,kinds:event.target.checked?[...current.current.kinds,kind]:current.current.kinds.filter(value=>value!==kind)})}/>{labels[kind]}</label>)}</fieldset>
   <label className={fieldLabelClass}>Custom patterns<textarea name="patterns" className={fieldClass} rows={3} value={patterns} onChange={event=>{setPatterns(event.target.value);current.current={...current.current,patterns:event.target.value.split(/\r?\n/).filter(Boolean)};setStatus('Unsaved changes');onSaving(true);onChange(current.current)}} onBlur={()=>{if(JSON.stringify(current.current)!==JSON.stringify(saved.current))update(current.current);else if(!saving.current){setStatus('');setFailed(false);onSaving(false)}}}/></label>
   <details className="text-sm"><summary className="cursor-pointer">Pattern help</summary><p className="mt-2">Use one pattern per line, up to ten. Literals, character classes and fixed repetitions such as ACCOUNT-[0-9]{4} are supported. Groups, variable repetition, lookarounds and backreferences are refused.</p></details>
  </fieldset>
  <div role="status" className="text-sm text-penny-muted">{status}</div>
  {failed?<button type="button" className={buttonClass} disabled={disabled} onClick={()=>update({...current.current,patterns:patterns.split(/\r?\n/).filter(Boolean)})}>Retry saving</button>:null}
 </form>
}

function StoredRedaction({run,setRun,enabled,saving}:{run:Run|null;setRun:(run:Run)=>void;enabled:boolean;saving:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmedPlan,setConfirmedPlan]=useState<string|null>(null),[refresh,setRefresh]=useState(0)
 const runId=run?.id,runState=run?.state,confirmed=!!run?.planHash&&confirmedPlan===run.planHash
 const places=run?.places??[],populated=places.filter(place=>place.records>0),empty=places.filter(place=>place.records===0)
 useEffect(()=>{
  if(!runId||!['previewing','running'].includes(runState??''))return
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>
  async function poll(){
   try{const response=await fetch(`${root}/runs/${runId}`,{signal:controller.signal});if(!response.ok)throw new Error('Could not refresh redaction progress.');const next=await response.json() as Run;if(!controller.signal.aborted){setRun(next);setError('');if(active(next))timer=setTimeout(poll,1000)}}
   catch(cause){if(!controller.signal.aborted)setError(message(cause,'Could not refresh redaction progress.'))}
  }
  timer=setTimeout(poll,1000)
  return ()=>{controller.abort();clearTimeout(timer)}
 },[runId,runState,setRun,refresh])
 async function start(path:string,input:Record<string,unknown>){
  setBusy(true);setError('')
  try{setRun(await operatorMutation(root+path,input) as Run);setConfirmedPlan(null)}catch(cause){setError(message(cause,'Could not start redaction.'))}finally{setBusy(false)}
 }
 return <div className="mt-6 space-y-4">
  <h3 className="font-bold">Stored captures</h3>
  <p>Preview stored text by place before permanently removing matches. Binary attachments keep their original bytes.</p>
  <button type="button" className={buttonClass} disabled={busy||saving||!enabled||active(run)} onClick={()=>void start('/preview',{})}>Preview stored evidence redaction</button>
  {run?<div className="space-y-4" aria-label="Stored redaction progress">
   <p role="status">{run.state==='previewing'?`Previewing stored text: ${records(run.scanned)} scanned.`:run.state==='ready'?`${records(run.records)} checked; ${run.changes} will change.`:run.state==='running'?`Redacting stored text: ${records(run.changed)} changed; ${run.scanned} scanned.`:run.state==='complete'?`Redaction complete: ${records(run.changed)} changed.`:'Redaction stopped. Progress is saved.'}</p>
   {active(run)?<progress className="w-full" aria-label={run.state==='previewing'?'Preview progress':'Redaction progress'} max={Math.max(1,run.records)} value={run.scanned} />:null}
   {populated.length?<PlaceRows places={populated}/>:null}
   {empty.length?<details><summary className="cursor-pointer text-sm">{empty.length} empty places</summary><div className="mt-3"><PlaceRows places={empty}/></div></details>:null}
   {run.state==='ready'&&run.planHash?<form className="space-y-3" onSubmit={event=>{event.preventDefault();if(confirmed)void start('/reapply',{planHash:run.planHash,confirmIrreversible:true})}}>
    <p>Matched wording is permanently removed from the listed editable records, including their stored copies. Preserved history stays unchanged.</p>
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" required checked={confirmed} onChange={event=>setConfirmedPlan(event.target.checked?run.planHash:null)}/>I understand this permanently removes the matched wording.</label>
    <button className={buttonClass} disabled={busy||saving||!confirmed||run.changes===0}>Redact stored evidence permanently</button>
   </form>:null}
   {run.state==='failed'||error?<><p role="alert">{error||(run.error==='redaction_rules_changed'?'Rules changed. Start a new preview.':run.error==='redaction_preview_stale'?'Stored text changed. Start a new preview.':'Redaction could not finish. Progress is saved; the owner can resume.')}</p>{run.state==='failed'?<button type="button" className={buttonClass} disabled={busy||saving} onClick={()=>void start(`/runs/${run.id}/resume`,{})}>Resume redaction</button>:active(run)?<button type="button" className={buttonClass} onClick={()=>{setError('');setRefresh(value=>value+1)}}>Refresh progress</button>:null}</>:null}
  </div>:null}
  {!run&&error?<p role="alert">{error}</p>:null}
 </div>
}

function PlaceRows({places}:{places:Run['places']}){
 return <ul className="space-y-3" aria-label="Stored text places">{places.map(place=><li key={place.table} className="min-w-0 break-words" data-redaction-place={place.table}><p className="font-bold">{place.label}</p><p className="text-sm text-penny-muted">{records(place.records)}{place.changes===null?' · Preserved history':` · ${place.changes} with matches`}</p>{place.blocked&&place.reason?<p className="text-sm">{place.reason}</p>:null}</li>)}</ul>
}

function OwnerSettings({initial}:{initial:Settings}){
 const [run,setRun]=useState(initial.latestRun),[saving,setSaving]=useState(false),[enabled,setEnabled]=useState(initial.enabled)
 return <><RulesForm initial={initial} disabled={active(run)} onSaving={setSaving} onChange={rules=>{setEnabled(rules.enabled);setRun(null)}}/><StoredRedaction run={run} setRun={setRun} enabled={enabled} saving={saving}/></>
}
export function RedactionSettings(){
 const [resource]=useOperatorResource<Settings>(root)
 return <SectionCard id="evidence-redaction" icon="form" title="Sensitive evidence redaction" description="Rules mark sensitive wording before captured text is stored.">
  {resource.kind==='ready'&&resource.data.canConfigure?<OwnerSettings initial={resource.data}/>:<p>{resource.kind==='loading'?'Loading redaction settings…':'Owner access is required to configure redaction.'}</p>}
 </SectionCard>
}
