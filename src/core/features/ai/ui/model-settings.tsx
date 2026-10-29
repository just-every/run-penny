import {useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {operatorMutation} from '../../requests/ui/operator-client'
import {buttonClass,fieldClass} from '../../auth/client-mutations'
import {fieldLabelClass} from '@/core/ui/app/classes'
import {SectionCard} from '@/core/ui/app/SectionCard'
interface Data {canConfigure:boolean;monthlyBudgetMicros:number;includePrivate:boolean;transport:boolean;report:{month:string;meteredMicros:number;reservedMicros:number;inputTokens:number;outputTokens:number};capabilities:{id:string;label:string;provider:string;model:string}[];catalog:{provider:string;id:string;inputMicrosPerToken:number;outputMicrosPerToken:number}[]}
const dollars=(micros:number)=>(micros/1000000).toFixed(6)
export function ModelSettings(){
 const [resource,reload]=useOperatorResource<Data>('/api/operator/settings/ai')
 if(resource.kind==='ready'&&(!resource.data.transport||!resource.data.catalog.length))return <SectionCard id="ai-models" icon="form" title="AI models and budget" description="Off until your host adds a model key and a secure outbound connection."/>
 return <SectionCard className="[&_h2]:scroll-mt-24" id="ai-models" icon="form" title="AI models and budget" description="Choose a model for each capability. Claude is the default. Provider keys are controlled by the installation and are never shown or stored here.">
 {resource.kind==='ready'?<ModelForm key={JSON.stringify(resource.data)} data={resource.data} reload={reload}/>:<div><p role={resource.kind==='loading'?'status':'alert'}>{resource.kind==='loading'?'Loading AI settings…':'AI settings could not be loaded. Check the installation model configuration.'}</p>{resource.kind!=='loading'?<button className={buttonClass} onClick={reload}>Retry AI settings</button>:null}</div>}
 </SectionCard>
}
function ModelForm({data,reload}:{data:Data;reload:()=>void}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[privateContext,setPrivate]=useState(data.includePrivate)
 return <form aria-label="AI configuration" className="space-y-5 min-w-0" onSubmit={async e=>{
  e.preventDefault();const form=new FormData(e.currentTarget),choices=data.capabilities.flatMap(c=>{const value=String(form.get(c.id)??'');if(!value)return [];const [provider,model]=JSON.parse(value);return [{capability:c.id,provider,model}]});setBusy(true)
  try{await operatorMutation('/api/operator/settings/ai',{monthlyBudgetMicros:Math.round(Number(form.get('budget'))*1000000),includePrivate:privateContext,choices},'PUT');reload()}catch(error){setMessage(error instanceof Error?error.message:'Could not save AI settings.')}finally{setBusy(false)}
 }}>
 <p className="text-sm">Private notes and commercial fields, including account names, are never sent to a model by default. Enabling private context permits only fields your current role can see.</p>
 <fieldset disabled={!data.canConfigure||busy} className="space-y-5 min-w-0">
 <label className={fieldLabelClass}>Monthly AI budget (USD)<input className={fieldClass} type="number" name="budget" min="0" max="100000" step="0.000001" required defaultValue={data.monthlyBudgetMicros/1000000}/></label>
 <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={privateContext} onChange={e=>setPrivate(e.target.checked)}/>Allow permitted private context in model prompts</label>
 <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">{data.capabilities.map(c=><label className={`${fieldLabelClass} min-w-0`} key={c.id}>{c.label}<select aria-label={c.label} name={c.id} className={`${fieldClass} w-full min-w-0`} defaultValue={data.catalog.some(m=>m.provider===c.provider&&m.id===c.model)?JSON.stringify([c.provider,c.model]):''}><option value="">Claude default — unavailable unless configured</option>{data.catalog.map(m=><option key={m.provider+m.id} value={JSON.stringify([m.provider,m.id])}>{m.provider==='anthropic'?'Anthropic':'OpenAI'} · {m.id}</option>)}</select></label>)}</div>
 {data.canConfigure?<button className={buttonClass} disabled={busy}>{busy?'Saving…':'Save AI settings'}</button>:<p>Only the installation owner can change AI settings.</p>}
 </fieldset>
 <div className="rounded-lg border border-penny-line p-4 space-y-2" aria-label="AI cost report"><h3 className="font-bold">{data.report.month} · USD cost</h3><p>Metered: ${dollars(data.report.meteredMicros)} · Reserved or uncertain: ${dollars(data.report.reservedMicros)}</p><p>{data.report.inputTokens} input tokens · {data.report.outputTokens} output tokens</p><p className="text-sm">The cap resets each UTC calendar month. Calls reserve their upper bound before egress. Unknown costs keep their reservation; there are no automatic retries. Learning also keeps its investigation ceiling.</p></div>
 <p role="status">{message}</p>
 </form>
}
