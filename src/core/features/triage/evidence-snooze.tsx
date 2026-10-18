import { useEffect,useState } from 'react'
import { fieldClass } from '../auth/client-mutations'
import { disclosureSummaryClass,fieldLabelClass,secondaryButtonClass } from '@/core/ui/app/classes'
import { operatorMutation } from '../requests/ui/operator-client'
export function EvidenceSnooze({id,onSaved}:{id:string;onSaved?:()=>void}){
 const [message,setMessage]=useState(''),[ready,setReady]=useState(false)
 useEffect(()=>{setReady(true)},[])
 return <details className="group mt-4 border-t border-penny-line pt-2"><summary className={disclosureSummaryClass}>Snooze evidence</summary><form className="mt-3 space-y-3" onSubmit={async e=>{e.preventDefault();const until=String(new FormData(e.currentTarget).get('until'));try{await operatorMutation(`/api/operator/triage/evidence/${id}/snooze`,{until:new Date(until).toISOString()},'PATCH');setMessage('Evidence snoozed. Find it in Overview → Snoozed evidence.');onSaved?.()}catch(error){setMessage(error instanceof Error?error.message:'Could not snooze evidence.')}}}><label className={`${fieldLabelClass} min-w-0`}>Return to inbox on<input className={`${fieldClass} max-w-full`} type="datetime-local" name="until" required disabled={!ready}/></label><button disabled={!ready} className={secondaryButtonClass}>Save snooze</button></form><p role="status" className="mt-3 text-sm empty:hidden">{message}</p></details>
}
