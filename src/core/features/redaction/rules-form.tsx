import {useEffect,useEffectEvent,useRef,useState} from 'react'
import {useHydrated} from '@/core/app/ui/hydrated'
import {buttonClass,fieldClass} from '../auth/client-mutations'
import {disclosureSummaryClass,fieldLabelClass} from '@/core/ui/app/classes'
import {compilePattern,kinds,type Rules} from './engine'
import {errorMessage} from './run-view'

const root='/api/operator/settings/redaction'
const labels={ssn:'US Social Security numbers',card:'Payment card numbers',phone:'Phone numbers',email:'Email addresses',credential:'Credential assignments'}
type Field='enabled'|'kinds'|'patterns'
type SaveState={kind:'draft'|'saving'|'saved'|'failed';message?:string}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
const patternLines=(text:string)=>text.split(/\r?\n/).filter(Boolean)
function patternError(patterns:string[]){
 try{if(patterns.length>10)throw new Error('Use at most ten patterns.');patterns.forEach(compilePattern);return ''}
 catch(error){return errorMessage(error,'Use fixed-width patterns.')}
}

export function RulesForm({initial,draftScope,disabled,onChange,onSaving}:{initial:Rules;draftScope:string;disabled:boolean;onChange:(rules:Rules)=>void;onSaving:(saving:boolean)=>void}){
 const hydrated=useHydrated(),draftKey=`penny:redaction:patterns:${draftScope}`
 const [rules,setRules]=useState<Rules>(()=>({enabled:initial.enabled,kinds:initial.kinds,patterns:initial.patterns})),[patterns,setPatterns]=useState(initial.patterns.join('\n')),[status,setStatuses]=useState<Partial<Record<Field,SaveState>>>({}),[storageError,setStorageError]=useState('')
 const queued=useRef(new Set<Field>()),saving=useRef(false),current=useRef(rules),saved=useRef(rules),text=useRef(patterns),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined)
 const setStatus=(field:Field,next:SaveState|undefined)=>setStatuses(all=>({...all,[field]:next}))
 function keepDraft(value:string){
  try{localStorage.setItem(draftKey,value);setStorageError('');return true}
  catch{setStorageError('This browser could not keep the draft. Keep this tab open until it saves.');return false}
 }
 function forgetDraft(){try{localStorage.removeItem(draftKey);setStorageError('')}catch{/* The saved server value is already durable. */}}
 // Each field saves on its own. A toggle writes the last saved patterns, so a
 // refused pattern line never holds back Enable or a kind.
 async function save(field:Field){
  const invalid=field==='patterns'?patternError(current.current.patterns):''
  if(invalid){setStatus(field,{kind:'failed',message:invalid});return}
  queued.current.add(field);setStatus(field,{kind:'saving'})
  if(saving.current)return
  saving.current=true;onSaving(true);let fields:Field[]=[]
  try{
   while(queued.current.size){
    fields=[...queued.current].filter(field=>field!=='patterns'||!patternError(current.current.patterns));queued.current.clear()
    if(!fields.length)continue
    const value={...current.current,patterns:fields.includes('patterns')?current.current.patterns:saved.current.patterns}
    const response=await fetch(root,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value),keepalive:true})
    if(!response.ok){const result=await response.json() as {message?:string};throw new Error(result.message??'Could not save these rules.')}
    saved.current=value
    if(same(patternLines(text.current),value.patterns))forgetDraft()
    for(const done of fields)if(!queued.current.has(done)&&same(current.current[done],value[done]))setStatus(done,{kind:'saved'})
   }
  }catch(error){
   const message=error instanceof TypeError?"Couldn't save.":errorMessage(error,"Couldn't save.")
   for(const failed of new Set([...fields,...queued.current]))setStatus(failed,{kind:'failed',message})
   queued.current.clear()
  }finally{saving.current=false;onSaving(!same(current.current,saved.current))}
 }
 function update(next:Rules,field:Field){current.current=next;setRules(next);onChange(next);void save(field)}
 function editPatterns(value:string){
  clearTimeout(timer.current);text.current=value;setPatterns(value)
  const lines=patternLines(value)
  if(!same(lines,current.current.patterns)){current.current={...current.current,patterns:lines};setRules(current.current);onChange(current.current)}
  // Lines that parse to the saved rules leave nothing to save or keep.
  if(same(lines,saved.current.patterns)&&!saving.current){
   forgetDraft();setStatuses(all=>({...all,patterns:all.patterns?.kind==='saved'?all.patterns:undefined}));onSaving(!same(current.current,saved.current));return
  }
  const kept=keepDraft(value),invalid=patternError(lines)
  onSaving(true);setStatus('patterns',invalid?{kind:'failed',message:invalid}:kept?{kind:'draft'}:undefined)
  if(!invalid)timer.current=setTimeout(()=>void save('patterns'),600)
 }
 // Applying the stored draft again is safe: a draft already in the field gets
 // its save scheduled again (StrictMode runs this effect twice).
 const restoreDraft=useEffectEvent(()=>{
  let draft:string|null=null
  try{draft=localStorage.getItem(draftKey)}catch{setStorageError('This browser could not read the saved draft.')}
  if(draft!==null)editPatterns(draft)
 })
 // While a run is active the draft waits, so a visit never saves over confirmed work.
 useEffect(()=>{if(!disabled)restoreDraft();return ()=>clearTimeout(timer.current)},[draftKey,disabled])
 function feedback(field:Field){
  const state=status[field]
  if(!state)return null
  return <span className="text-sm font-normal" role={state.kind==='failed'?'alert':'status'} aria-label={`${field} save status`} data-save-state={state.kind}>
   {state.kind==='saved'?'Saved':state.kind==='saving'?'Saving…':state.kind==='draft'?'Draft kept':state.message}
   {state.kind==='failed'&&(field!=='patterns'||!patternError(rules.patterns))?<button type="button" className={buttonClass} disabled={disabled||!hydrated} onClick={()=>void save(field)}>Retry saving</button>:null}
  </span>
 }
 return <form className="space-y-4" aria-label="Redaction rules" onSubmit={event=>event.preventDefault()}>
  <fieldset disabled={disabled||!hydrated} className="space-y-4">
   <div><div className="flex flex-wrap items-center gap-x-3"><label className="flex min-h-11 items-center gap-2"><input name="enabled" type="checkbox" checked={rules.enabled} onChange={event=>update({...current.current,enabled:event.target.checked},'enabled')}/>Enable redaction for new captures</label>{feedback('enabled')}</div></div>
   <fieldset className="space-y-2"><legend className="font-bold">Default kinds</legend>{feedback('kinds')}{kinds.map(kind=><label key={kind} className="flex min-h-11 items-center gap-2"><input name="kinds" value={kind} type="checkbox" checked={rules.kinds.includes(kind)} onChange={event=>update({...current.current,kinds:event.target.checked?[...current.current.kinds,kind]:current.current.kinds.filter(value=>value!==kind)},'kinds')}/>{labels[kind]}</label>)}</fieldset>
   <div><div className="flex flex-wrap items-center gap-x-3"><label htmlFor="redaction-patterns" className={fieldLabelClass}>Custom patterns</label>{status.patterns?.kind!=='failed'?feedback('patterns'):null}</div><textarea id="redaction-patterns" name="patterns" className={fieldClass} rows={3} value={patterns} onChange={event=>editPatterns(event.target.value)} onBlur={()=>{clearTimeout(timer.current);if(!same(current.current.patterns,saved.current.patterns))void save('patterns')}}/>{status.patterns?.kind==='failed'?feedback('patterns'):null}{storageError?<p role="alert" className="text-sm">{storageError}</p>:null}</div>
   <details className="group text-sm"><summary className={disclosureSummaryClass}>Pattern help</summary><p className="mt-2">One pattern per line, up to ten. Use literals, character classes and fixed repetitions: <code>{'ACCOUNT-[0-9]{4}'}</code>.</p><p className="mt-2">Groups, variable repetition, lookarounds and backreferences are refused.</p></details>
  </fieldset>
 </form>
}
