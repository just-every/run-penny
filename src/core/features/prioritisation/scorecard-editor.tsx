import {useState,useRef} from 'react'
import {Field,LoopForm,controlClass} from '@/core/app/ui/loop-form'
import {fieldLabelClass} from '@/core/ui/app/classes'
import type {Criterion,ScorecardResult} from './scorecard-model'
export function ScorecardEditor({card,onSaved}:{card?:ScorecardResult;onSaved:()=>void}){
 const [criteria,setCriteria]=useState<(Criterion&{key:number})[]>((card?.versions[0].criteria??[{name:'Customer impact',scale:5,weight:1}]).map((criterion,key)=>({...criterion,key})))
 const nextKey=useRef(criteria.length)
 return <LoopForm title={card?'Revise criteria':'Create scorecard'} action={`/api/operator/scorecards${card?`/${card.id}`:''}`} method={card?'PUT':'POST'} submit={card?'Save new criteria version':'Create scorecard'} onSaved={onSaved} transform={data=>({name:data.get('name'),entity:card?.entity??data.get('entity'),criteria:criteria.map((_,i)=>({name:data.get(`criterion.${i}.name`),scale:Number(data.get(`criterion.${i}.scale`)),weight:Number(data.get(`criterion.${i}.weight`))})),...(card?{revision:card.revision}:{})})}>
 <Field name="name" label="Scorecard name" value={card?.name} required/>
 {!card?<Field name="entity" label="Ideas to score" value="requests" choices={[{id:'requests',label:'Requests'},{id:'features',label:'Features'}]} required/>:null}
 <p className="text-sm text-penny-muted">Each input is divided by its scale, multiplied by its weight, then combined as a weighted percentage. Rankings use the mean of complete scorer results for the current criteria version. Earlier inputs remain under their original version.</p>
 {criteria.map((criterion,index)=><fieldset key={criterion.key} className="min-w-0 rounded-lg border border-penny-line p-3"><legend className="px-1 font-semibold">Criterion {index+1}</legend><div className="grid gap-3 sm:grid-cols-3"><Field name={`criterion.${index}.name`} label={`Criterion ${index+1} name`} value={criterion.name} required/><Field name={`criterion.${index}.scale`} label={`Criterion ${index+1} scale`} value={String(criterion.scale)} choices={[{id:'5',label:'1–5'},{id:'10',label:'1–10'}]} required/><label className={fieldLabelClass}>Criterion {index+1} weight<input className={controlClass} type="number" name={`criterion.${index}.weight`} min="0.001" max="1000" step="any" defaultValue={criterion.weight} required/></label></div>{criteria.length>1?<button type="button" className="mt-3 min-h-11 underline" onClick={()=>setCriteria(current=>current.filter((_,i)=>i!==index))}>Remove criterion {index+1}</button>:null}</fieldset>)}
 {criteria.length<20?<button type="button" className="block min-h-11 underline" onClick={()=>{const key=nextKey.current++;setCriteria(current=>[...current,{key,name:'',scale:5,weight:1}])}}>Add criterion</button>:null}
 </LoopForm>
}
