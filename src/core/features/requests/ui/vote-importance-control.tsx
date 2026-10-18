import { fieldClass,fieldLabelClass,secondaryButtonClass } from '@/core/features/portal/ui/portal-classes'
export function VoteImportanceControl({choices,value,onChange,onSave,busy,voted}:{choices:readonly string[];value:string;onChange:(value:string)=>void;onSave:()=>void;busy:boolean;voted:boolean}){
 if(!choices.length)return null
 return <div className="space-y-2"><label className={fieldLabelClass}>How important is this to you? (optional)<select value={value} onChange={event=>onChange(event.target.value)} disabled={busy} className={fieldClass}><option value="">No importance selected</option>{choices.map((label,index)=><option key={index} value={String(index+1)}>{label}</option>)}</select></label>
 <p className="text-sm text-penny-muted">Your importance choice is private. Other visitors see only the vote total.</p>
 {voted?<button type="button" className={secondaryButtonClass} disabled={busy} onClick={onSave}>Save importance</button>:null}</div>
}
