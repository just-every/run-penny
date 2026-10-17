import {useState} from 'react'
import {fieldLabelClass,primaryButtonClass} from '@/core/ui/app/classes'
import {fieldClass} from '../../auth/client-mutations'
import {checkboxClass,checkRowClass} from '../../requests/ui/form-classes'
import type {SettingsAct} from '../../requests/ui/settings-boards'
export function BoardSubscriptionSettings({slug,enabled,version,act}:{slug:string;enabled:boolean;version:number;act:SettingsAct}){
 const [withdraw,setWithdraw]=useState(false)
 return <form className="mt-6 space-y-3 border-t border-penny-line pt-5" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);void act(`/api/operator/boards/${slug}/vote-subscriptions`,{enabled:data.get('enabled')==='on',version,withdrawExisting:withdraw,...(withdraw?{reason:data.get('reason')}:{})},'PUT')}}>
  <label className={checkRowClass}><input name="enabled" type="checkbox" defaultChecked={enabled} className={checkboxClass}/>Voting subscribes to updates</label>
  <p className="text-sm text-penny-muted">A postal address is required. Voters and authors see the subscription disclosure before participating. Turning this off keeps existing subscriptions.</p>
  <label className={checkRowClass}><input type="checkbox" checked={withdraw} onChange={e=>setWithdraw(e.target.checked)} className={checkboxClass}/>Withdraw all automatic vote subscriptions on this board</label>
  {withdraw?<label className={fieldLabelClass}>Recorded reason<input name="reason" required maxLength={2000} className={fieldClass}/></label>:null}
  <button className={primaryButtonClass}>Save vote subscriptions</button>
 </form>
}
