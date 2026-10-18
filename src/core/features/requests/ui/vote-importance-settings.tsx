import { useState } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorOptionsState } from '@/core/app/ui/operator-options-state'
import { disclosureSummaryClass,fieldLabelClass,inputClass,secondaryButtonClass } from '@/core/ui/app/classes'
import { operatorMutation } from './operator-client'
import type { ImportanceSettings } from '../vote-importance'
export function VoteImportanceSettings({slug}:{slug:string}){
 const [settings,reload]=useOperatorResource<ImportanceSettings&{canConfigure:boolean}>(`/api/operator/boards/${slug}/vote-importance`),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 return <details className="group mt-4 border-t border-penny-line pt-1"><summary className={disclosureSummaryClass}>Vote importance</summary>
 {settings.kind==='ready'?<form className="mt-3 space-y-3" onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setMessage('');const data=new FormData(event.currentTarget),labels=[1,2,3,4].map(index=>String(data.get(`importanceLabel${index}`)??'').trim()).filter(Boolean)
  try{await operatorMutation(`/api/operator/boards/${slug}/vote-importance`,{enabled:data.get('importanceEnabled')==='on',labels},'PUT');setMessage('Vote importance settings saved.');reload()}catch(error){setMessage(error instanceof Error?error.message:'Could not save importance settings.')}finally{setBusy(false)}}}>
 <p className="text-sm leading-6 text-penny-muted">Ask voters how important this request is to them. Their choice is optional and stays private to the team. Use three or four levels.</p>
 <fieldset disabled={busy||!settings.data.canConfigure} className="min-w-0 space-y-3"><legend className="sr-only">Importance choices</legend>
 <label className="flex min-h-11 items-center gap-2 text-sm"><input name="importanceEnabled" type="checkbox" defaultChecked={settings.data.enabled}/>Ask voters for importance</label>
 {[1,2,3,4].map(index=><label key={index} className={fieldLabelClass}>Importance level {index}{index===4?' (optional)':''}<input name={`importanceLabel${index}`} required={index<4} maxLength={80} defaultValue={settings.data.labels[index-1]??''} className={`mt-2 ${inputClass}`}/></label>)}
 <button className={secondaryButtonClass}>{busy?'Saving…':'Save importance settings'}</button></fieldset>
 {!settings.data.canConfigure?<p className="text-sm text-penny-muted">Only the installation owner can change importance choices.</p>:null}
 </form>:<OperatorOptionsState state={settings} loading="Loading importance settings…" failure="Could not load importance settings" reload={reload}/>}
 {message?<p role="status" className="mt-2 break-words text-sm text-penny-ink">{message}</p>:null}
 </details>
}
