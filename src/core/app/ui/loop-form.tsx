import {useOperatorResource} from './operator-resource'
import { OperatorSessionExpired } from './operator-resource-state'
import { createContext,useContext,useEffect,useId,useRef,useState,type FormEvent,type ReactNode } from 'react'
import { fieldLabelClass, inputClass, insetPanelClass, primaryButtonClass } from '@/core/ui/app/classes'
const MissingFields=createContext<readonly string[]>([])
export interface Choice{id:string;label:string}
export interface LoopFormAction{id:string;label:string;action?:string;transform?:(data:FormData)=>unknown;formNoValidate?:boolean;variant?:'primary'|'secondary';onClick?:()=>void}
export interface LoopOptions{operators:Choice[];accounts:Choice[];boards:(Choice&{visibility:'public'|'internal'})[];decisions:Choice[];requests:(Choice&{slug:string;publishedAt:string|null;publiclyVisible:boolean})[];bets:Choice[]}
export function useLoopOptions(){
 const [options,reload]=useOperatorResource<LoopOptions>('/api/operator/loop/options')
 useEffect(()=>{window.addEventListener('penny:loop-saved',reload);return()=>window.removeEventListener('penny:loop-saved',reload)},[reload])
 return {...options,reload}
}
export const controlClass=`mt-2 text-base ${inputClass}`
export function Field({name,label,value='',type='text',choices,required=false}:{name:string;label:string;value?:string|null;type?:string;choices?:readonly Choice[];required?:boolean}){
 const missing=useContext(MissingFields).includes(label),errorId=useId(),labelId=useId()
 const props={name,defaultValue:value??'',required,className:controlClass,'aria-labelledby':labelId,'aria-invalid':missing||undefined,'aria-describedby':missing?errorId:undefined}
 return <label className={fieldLabelClass}><span id={labelId}>{label}</span>{choices?<select key={choices.map(c=>c.id).join(',')} {...props}><option value="">Choose…</option>{choices.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>:type==='textarea'?<textarea {...props} rows={3}/>:<input {...props} type={type}/>} {missing?<span id={errorId} className="mt-1 block text-sm font-semibold text-penny-danger">{label} is required.</span>:null}</label>
}
// A form's frame: `panel` is a light inset of its own (several forms in one card); `none` sits straight in the card that holds
// it (a disclosure row or a section card), and `hidden` also leaves its title to that card's heading (it still names the form).
const frames={panel:`${insetPanelClass} p-4 sm:p-5`,none:'',hidden:''}
export function LoopForm({title,action,method='POST',children,transform,onSaved,submit='Save',reset=false,disabled=false,frame='panel',actions,actionsClassName='loop-form-actions'}:{title:string;action:string;method?:string;children:ReactNode;transform?:(data:FormData)=>unknown;onSaved?:()=>void;submit?:string;reset?:boolean;disabled?:boolean;frame?:keyof typeof frames;actions?:readonly LoopFormAction[];actionsClassName?:string}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[busyAction,setBusyAction]=useState<string|null>(null),[failed,setFailed]=useState(false),[sessionExpired,setSessionExpired]=useState(false),formRef=useRef<HTMLFormElement>(null)
 useEffect(()=>{if(failed)formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()},[failed,message])
 async function send(event:FormEvent<HTMLFormElement>){event.preventDefault();if(disabled||busy||sessionExpired)return;const form=event.currentTarget,submitter=(event.nativeEvent as SubmitEvent).submitter,selected=submitter instanceof HTMLButtonElement&&submitter.name==='loop-action'?actions?.find(item=>item.id===submitter.value):undefined;setBusy(true);setBusyAction(selected?.id??null);setMessage('');try{const data=new FormData(form),requestTransform=selected?.transform??transform;const response=await fetch(selected?.action??action,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(requestTransform?requestTransform(data):Object.fromEntries(data))});if(response.status===401){setFailed(false);setSessionExpired(true);return}const result=await response.json() as {message?:string;error?:string};if(!response.ok)throw new Error(result.message??result.error??'Could not save.');setFailed(false);setMessage('Saved.');window.dispatchEvent(new Event('penny:loop-saved'));if(reset)form.reset();onSaved?.()}catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'Could not save.')}finally{setBusy(false);setBusyAction(null)}}
 const missing=failed&&message.startsWith('Required: ')?message.slice(10).replace(/\.$/,'').split(', '):[]
 return <MissingFields.Provider value={missing}><form ref={formRef} aria-label={title} onSubmit={send} className={`min-w-0 space-y-5 ${frames[frame]}`}>{frame==='hidden'?null:<h3 className="text-lg font-bold text-penny-ink sm:text-xl">{title}</h3>}{children}{actions?<div className={actionsClassName} role="group" aria-label="Form actions">{actions.map(item=><button key={item.id} type={item.onClick?'button':'submit'} name={item.onClick?undefined:'loop-action'} value={item.onClick?undefined:item.id} formNoValidate={item.formNoValidate} data-variant={item.variant} disabled={busy||disabled||sessionExpired} onClick={item.onClick} className={item.variant==='primary'?primaryButtonClass:undefined}>{busy&&busyAction===item.id?'Saving…':item.label}</button>)}</div>:<button disabled={busy||disabled||sessionExpired} className={`${primaryButtonClass} w-full sm:w-auto`}>{busy?'Saving…':submit}</button>}{sessionExpired?<OperatorSessionExpired/>:message?<p role={failed?'alert':'status'} className={`break-words text-sm ${failed?'text-penny-danger':'text-penny-ink'}`}>{message}</p>:null}</form></MissingFields.Provider>
}
export function nullableForm(data:FormData){return Object.fromEntries([...data].map(([key,value])=>[key,value===''?null:value]))}
