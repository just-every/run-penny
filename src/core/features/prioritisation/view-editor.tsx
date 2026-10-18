import {useState,useId} from 'react'
import {Field,LoopForm,controlClass} from '@/core/app/ui/loop-form'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {OperatorResourceFailure,OperatorResourceLoading,OperatorSessionExpired} from '@/core/app/ui/operator-resource-state'
import {disclosureSummaryClass,fieldLabelClass} from '@/core/ui/app/classes'
import {viewInput,type ViewInput,type FormulaRow} from './formulas'
import type {SavedView} from './repository'
import {weightLabels,manualLabels} from './labels'
export function ViewEditor({saved,onSaved}:{saved?:SavedView;onSaved:()=>void}){
 const compareId=useId()
 const definition=saved?.view??viewInput.parse({name:'New comparison'})
 const [entity,setEntity]=useState(definition.entity),[limit,setLimit]=useState(25)
 const [rows,reload]=useOperatorResource<FormulaRow[]>(`/api/operator/prioritisation/rows?entity=${entity}`)
 function transform(form:FormData){
  const manualInputs:ViewInput['manualInputs']={...definition.manualInputs}
  if(rows.kind==='ready')for(const row of rows.data.slice(0,limit)){
   const values:Record<string,number>={}
   for(const key of Object.keys(manualLabels)){const input=form.get(`manual.${row.id}.${key}`);if(typeof input==='string'&&input.trim())values[key]=Number(input)}
   if(Object.keys(values).length)manualInputs[row.id]=values;else delete manualInputs[row.id]
  }
  return {name:form.get('name'),shared:form.get('shared')==='on',entity,formula:form.get('formula'),weights:Object.fromEntries(Object.keys(weightLabels).map(key=>[key,Number(form.get(`weight.${key}`))])),manualInputs,...(saved?{revision:saved.revision}:{})}
 }
 return <LoopForm title={saved?'Edit comparison':'Create comparison'} action={`/api/operator/prioritisation${saved?`/${saved.id}`:''}`} method={saved?'PUT':'POST'} submit="Save comparison" disabled={rows.kind!=='ready'} transform={transform} onSaved={onSaved}>
 <Field name="name" label="View name" value={definition.name} required/>
 <label className={fieldLabelClass}><span id={compareId}>Compare</span><select aria-labelledby={compareId} className={controlClass} value={entity} onChange={e=>{setEntity(e.target.value as ViewInput['entity']);setLimit(25)}}><option value="requests">Requests</option><option value="features">Features</option></select></label>
 <Field name="formula" label="Sorting formula" value={definition.formula} required choices={[{id:'none',label:'No formula (title order)'},{id:'rice',label:'RICE: voters × impact × confidence / effort'},{id:'value_over_effort',label:'Manual value / manual effort'},{id:'weighted_segment_demand',label:'Manual segment demand × reach weight'},{id:'weighted_sum',label:'Custom weighted sum'}]}/>
 <label className="flex min-h-11 items-center gap-3 text-sm"><input name="shared" type="checkbox" defaultChecked={definition.shared}/>Share with all operators (only you can edit)</label>
 <details className="group"><summary className={disclosureSummaryClass}>Formula weights</summary><p className="my-3 text-sm text-penny-muted">Custom sums multiply each input by its weight. RICE uses its fixed formula, with confidence divided by 100. Zero weights omit an input from a custom sum.</p><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(weightLabels).map(([key,label])=><label className={fieldLabelClass} key={key}>{label} weight<input className={controlClass} type="number" step="any" min="-100" max="100" name={`weight.${key}`} defaultValue={definition.weights[key as keyof typeof definition.weights]} required/></label>)}</div></details>
 <details className="group"><summary className={disclosureSummaryClass}>Per-row manual inputs</summary><p className="my-3 text-sm text-penny-muted">Blank means unknown. Manual values have no connection to CRM revenue, dynamic segments, scorecards or tracker estimates. Effort is positive; confidence is a percentage. All saved inputs are shown with the result.</p>
 {rows.kind==='loading'?<OperatorResourceLoading label="Loading comparison inputs…"/>:rows.kind==='session_expired'?<OperatorSessionExpired/>:rows.kind!=='ready'?<OperatorResourceFailure title="Could not load comparison inputs." onRetry={reload}/>:<>{rows.data.slice(0,limit).map(row=><fieldset key={row.id} className="my-4 min-w-0 rounded-lg border border-penny-line p-3"><legend className="max-w-full break-words px-1 font-semibold">{row.title}</legend><div className="grid gap-3 sm:grid-cols-2">{Object.entries(manualLabels).map(([key,label])=><label key={key} className={fieldLabelClass}>{label}<input name={`manual.${row.id}.${key}`} type="number" step="any" min={key==='effort'?'0.000001':'0'} max={key==='confidence'?'100':key==='impact'?'10':undefined} className={controlClass} defaultValue={definition.manualInputs[row.id]?.[key as keyof typeof manualLabels]??''}/></label>)}</div></fieldset>)}{limit<rows.data.length?<button type="button" className="min-h-11 underline" onClick={()=>setLimit(n=>n+25)}>Show more input rows</button>:null}</>}
 </details></LoopForm>
}
