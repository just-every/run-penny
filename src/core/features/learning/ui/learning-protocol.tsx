import { Field } from '@/core/app/ui/loop-form'
import type { Protocol } from './types'
export function ProtocolFields({protocol}:{protocol:Protocol}) {
 return <fieldset className="measurement"><legend>Pre-action measurement — correct before deciding</legend><div className="form-grid">
 {([['cohort','Eligible cohort'],['denominator','Cohort denominator'],['baseline','Baseline'],['window','Measurement window'],['measure','Outcome measure'],['dataSource','Measure source'],['comparison','Comparison'],['limits','Comparison limits'],['stopRule','Stop rule']] as const).map(([name,label])=><Field key={name} name={name} label={label} type={name==='denominator'?'number':'text'} value={protocol[name]===null?'':String(protocol[name])} required/>)}
 <CurrencyField name="protocolBudget" label="Action budget (USD)" value={protocol.budgetMicros/1e6}/>
 </div><p>Estimates are not observed outcomes. No contact, publication or production effect is authorized by this internal decision.</p></fieldset>
}
export function CurrencyField({name,label,value}:{name:string;label:string;value?:number}) {return <label className="block text-sm font-semibold">{label}<input className="mt-2 block w-full rounded-lg border border-penny-line bg-penny-paper p-3 text-base" name={name} type="number" min="0" step="any" defaultValue={value} required/></label>}
