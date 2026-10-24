import {useEffect,useRef,useState} from 'react'
import {useHydrated} from '@/core/app/ui/hydrated'
import {buttonClass,fieldClass} from '../auth/client-mutations'
import {disclosureSummaryClass,fieldLabelClass} from '@/core/ui/app/classes'
import {compilePattern,kinds,type Rules} from './engine'
import {errorMessage} from './run-view'

const root='/api/operator/settings/redaction'
const labels={ssn:'US Social Security numbers',card:'Payment card numbers',phone:'Phone numbers',email:'Email addresses',credential:'Credential assignments'}
type Field='enabled'|'kinds'|'patterns'
type SaveState={field:Field;kind:'draft'|'saving'|'saved'|'failed';message?:string}|null
const same=(a:Rules,b:Rules)=>JSON.stringify(a)===JSON.stringify(b)
const patternLines=(text:string)=>text.split(/\r?\n/).filter(Boolean)
function patternError(patterns:string[]){
 try{if(patterns.length>10)throw new Error('Use at most ten patterns.');patterns.forEach(compilePattern);return ''}
 catch(error){return errorMessage(error,'Use fixed-width patterns.')}
}

export function RulesForm({initial,draftScope,disabled,onChange,onSaving}:{initial:Rules;draftScope:string;disabled:boolean;onChange:(rules:Rules)=>void;onSaving:(saving:boolean)=>void}){
 const hydrated=useHydrated(),draftKey=`penny:redaction:patterns:${draftScope}`
 const [rules,setRules]=useState<Rules>(()=>({enabled:initial.enabled,kinds:initial.kinds,patterns:initial.patterns})),[patterns,setPatterns]=useState(initial.patterns.join('\n')),[status,setStatus]=useState<SaveState>(null),[storageError,setStorageError]=useState('')
 const pending=useRef<{rules:Rules;field:Field}|null>(null),saving=useRef(false),current=useRef(rules),saved=useRef(rules),text=useRef(patterns),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined)
 function keepDraft(value:string){
  try{localStorage.setItem(draftKey,value);setStorageError('')}
  catch{setStorageError('This browser could not keep the draft. Keep this tab open until it saves.')}
 }
 async function save(next:Rules,field:Field){
  const invalid=patternError(next.patterns)
  if(invalid){setStatus({field:'patterns',kind:'failed',message:invalid});onSaving(true);return}
  pending.current={rules:next,field}
  if(saving.current)return
  saving.current=true;onSaving(true)
  try{
   while(pending.current){
    const value=pending.current;pending.current=null;setStatus({field:value.field,kind:'saving'})
    const response=await fetch(root,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value.rules),keepalive:true})
    if(!response.ok){const result=await response.json() as {message?:string};throw new Error(result.message??'Could not save these rules.')}
    saved.current=value.rules
    if(text.current===value.rules.patterns.join('\n')){try{localStorage.removeItem(draftKey);setStorageError('')}catch{/* The saved server value is already durable. */}}
    if(same(current.current,saved.current))setStatus({field:value.field,kind:'saved'})
   }
   const dirty=!same(current.current,saved.current);onSaving(dirty)
   if(dirty)setStatus({field:'patterns',kind:'draft'})
  }catch(error){pending.current=null;setStatus({field,kind:'failed',message:error instanceof TypeError?"Couldn't save.":errorMessage(error,"Couldn't save.")});onSaving(true)}
  finally{saving.current=false}
 }
 function update(next:Rules,field:Field){current.current=next;setRules(next);onChange(next);void save(next,field)}
 function editPatterns(value:string){
  clearTimeout(timer.current);keepDraft(value);text.current=value;setPatterns(value)
  const next={...current.current,patterns:patternLines(value)},invalid=patternError(next.patterns)
  current.current=next;setRules(next);onChange(next);onSaving(true)
  setStatus(invalid?{field:'patterns',kind:'failed',message:invalid}:{field:'patterns',kind:'draft'})
  if(!invalid)timer.current=setTimeout(()=>void save(current.current,'patterns'),600)
 }
 useEffect(()=>{
  try{const draft=localStorage.getItem(draftKey);if(draft!==null&&draft!==text.current)editPatterns(draft)}
  catch{setStorageError('This browser could not read the saved draft.')}
  return ()=>clearTimeout(timer.current)
 },[draftKey])
 function feedback(field:Field){
  if(status?.field!==field)return null
  return <span className="text-sm font-normal" role={status.kind==='failed'?'alert':'status'} aria-label={`${field} save status`} data-save-state={status.kind}>
   {status.kind==='saved'?'Saved':status.kind==='saving'?'Saving…':status.kind==='draft'?'Draft kept':status.message}
   {status.kind==='failed'&&!patternError(current.current.patterns)?<button type="button" className={buttonClass} disabled={disabled||!hydrated} onClick={()=>void save(current.current,field)}>Retry saving</button>:null}
  </span>
 }
 return <form className="space-y-4" aria-label="Redaction rules" onSubmit={event=>event.preventDefault()}>
  <fieldset disabled={disabled||!hydrated} className="space-y-4">
   <div><div className="flex flex-wrap items-center gap-x-3"><label className="flex min-h-11 items-center gap-2"><input name="enabled" type="checkbox" checked={rules.enabled} onChange={event=>update({...current.current,enabled:event.target.checked},'enabled')}/>Enable redaction for new captures</label>{feedback('enabled')}</div></div>
   <fieldset className="space-y-2"><legend className="font-bold">Default kinds</legend>{feedback('kinds')}{kinds.map(kind=><label key={kind} className="flex min-h-11 items-center gap-2"><input name="kinds" value={kind} type="checkbox" checked={rules.kinds.includes(kind)} onChange={event=>update({...current.current,kinds:event.target.checked?[...current.current.kinds,kind]:current.current.kinds.filter(value=>value!==kind)},'kinds')}/>{labels[kind]}</label>)}</fieldset>
   <div><div className="flex flex-wrap items-center gap-x-3"><label htmlFor="redaction-patterns" className={fieldLabelClass}>Custom patterns</label>{status?.kind!=='failed'?feedback('patterns'):null}</div><textarea id="redaction-patterns" name="patterns" className={fieldClass} rows={3} value={patterns} onChange={event=>editPatterns(event.target.value)} onBlur={()=>{clearTimeout(timer.current);if(!same(current.current,saved.current))void save(current.current,'patterns')}}/>{status?.kind==='failed'?feedback('patterns'):null}{storageError?<p role="alert" className="text-sm">{storageError}</p>:null}</div>
   <details className="group text-sm"><summary className={disclosureSummaryClass}>Pattern help</summary><p className="mt-2">One pattern per line, up to ten. Use literals, character classes and fixed repetitions: <code>{'ACCOUNT-[0-9]{4}'}</code>.</p><p className="mt-2">Groups, variable repetition, lookarounds and backreferences are refused.</p></details>
  </fieldset>
 </form>
}
