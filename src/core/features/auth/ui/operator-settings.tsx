import { useState, type FormEvent } from 'react'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import { operatorMutation } from '@/core/features/requests/ui/operator-client'
import type { ManagedOperator } from '../operator-management'
import { useMailSuppressed } from '@/core/features/releases/ui/delivery-counts'

const endpoint='/api/operator/settings/operators'
const button='min-h-11 rounded-lg border border-penny-accent/50 px-4 py-2 text-sm font-semibold text-penny-accent hover:bg-penny-accent/5 disabled:opacity-50'
export function OperatorSettings() {
  const [resource,refresh]=usePublicResource<{operators:ManagedOperator[]}>(endpoint)
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false),[removing,setRemoving]=useState<string|null>(null),[successorId,setSuccessorId]=useState('')
  const mailSuppressed=useMailSuppressed()
  const operators=resource.kind==='ready'?resource.data.operators:[]
  async function invite(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const form=event.currentTarget
    setBusy(true);setMessage('');setError(false)
    try {await operatorMutation(endpoint,{email:new FormData(form).get('email')});form.reset();setMessage(mailSuppressed?'Invitation recorded. Penny Dev sends no email, so no message was sent; on a deployed copy the operator gets a sign-in email.':'Invitation sent. Ask the operator to open their email and confirm sign-in.');refresh()}
    catch(e){setError(true);setMessage(e instanceof Error?e.message:'Could not invite operator.')}
    finally{setBusy(false)}
  }
  async function remove(operator:ManagedOperator) {
    setBusy(true);setMessage('');setError(false)
    try {await operatorMutation(`${endpoint}/${operator.id}`,operator.installationOwner?{successorId}:{},'DELETE');if(operator.self){window.location.assign('/signin');return}setMessage(operator.status==='invited'?'Invitation cancelled.':'Operator removed. Their sessions, links and API keys no longer work.');setRemoving(null);refresh()}
    catch(e){setError(true);setMessage(e instanceof Error?e.message:'Could not remove operator.')}
    finally{setBusy(false)}
  }
  return <section id="settings-operators" aria-labelledby="operators-heading" className="min-w-0 space-y-5">
    <div className="rounded-xl border border-penny-line bg-penny-card p-5 sm:p-6">
      <h2 id="operators-heading" className="text-xl font-bold tracking-tight">Operators</h2>
      <p className="mt-1 text-sm text-penny-muted">Every operator has equal access to the feedback workspace.</p>
      <form onSubmit={invite} className="mt-5 border-t border-penny-line pt-5">
        <h3 className="font-bold">Invite by email</h3>
        <div className="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-sm font-medium">Email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="name@example.com" disabled={busy||resource.kind!=='ready'} className="mt-1.5 block min-h-11 w-full rounded-lg border border-penny-line bg-transparent px-3 text-base" /></label>
          <button disabled={busy||resource.kind!=='ready'} className="min-h-11 rounded-lg bg-penny-accent px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy?'Working…':'Invite operator'}</button>
        </div>
      </form>
    </div>
    <p role={error?'alert':'status'} className={`text-sm empty:hidden ${error?'text-penny-danger':'text-penny-moss'}`}>{message}</p>
    {resource.kind==='loading'?<p role="status" className="text-penny-muted">Loading operators…</p>:null}
    {resource.kind==='error'?<div role="alert" className="text-sm text-penny-danger">Could not load operators. <button onClick={refresh} className={button}>Try again</button></div>:null}
    {resource.kind==='ready'?<ul aria-label="Workspace operators" className="divide-y divide-penny-line overflow-hidden rounded-xl border border-penny-line bg-penny-card">
      {operators.filter(o=>o.status!=='inactive').map(operator=>{
        const successors=operators.filter(o=>o.id!==operator.id&&o.status==='active'&&o.canSucceed)
        const allowed=(!operator.initialOwner||operator.self)&&(!operator.installationOwner||(operator.self&&successors.length>0))
        return <li key={operator.id} className="p-4 sm:px-6 sm:py-5">
          <div className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:flex sm:flex-wrap sm:gap-5">
            <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-penny-paper text-sm font-semibold text-penny-muted">{operator.displayName.slice(0,2).toUpperCase()}</span>
            <div className="min-w-0 flex-1"><p className="break-words font-semibold">{operator.displayName}</p><p className="break-all text-sm text-penny-muted">{operator.email}</p></div>
            <div className="col-span-2 flex flex-wrap gap-2 text-xs sm:col-auto">
              {operator.self?<span className="rounded-full bg-penny-accent px-2.5 py-1 font-semibold text-white">You</span>:null}
              {operator.installationOwner?<span className="rounded-full bg-penny-paper px-2.5 py-1">Installation owner</span>:null}
              {operator.status==='invited'?<span className="rounded-full bg-penny-paper px-2.5 py-1">Pending invitation</span>:null}
            </div>
            <button type="button" className={`${button} col-span-2 justify-self-end sm:ml-auto`} disabled={busy||!allowed} aria-label={`${operator.status==='invited'?'Cancel invitation for':'Remove'} ${operator.email}`} onClick={()=>{setRemoving(operator.id);setSuccessorId('')}}>{operator.status==='invited'?'Cancel invitation':'Remove'}</button>
          </div>
          {removing===operator.id?<div className="mt-4 rounded-lg border border-penny-accent/30 p-4" role="group" aria-label={`Confirm removal of ${operator.email}`}>
            <p className="text-sm">{operator.self?'Remove yourself from this workspace?':'Remove this operator?'} Existing sessions, links and API keys will stop working immediately.</p>
            {operator.installationOwner?<label className="mt-3 block text-sm font-medium">Hand ownership to<select value={successorId} onChange={event=>setSuccessorId(event.target.value)} className="mt-1.5 block min-h-11 w-full rounded-lg border border-penny-line bg-transparent px-3 text-base"><option value="" disabled>Choose the next installation owner</option>{successors.map(o=><option key={o.id} value={o.id}>{o.email}</option>)}</select><span className="mt-1.5 block font-normal text-penny-muted">They receive installation controls for branding and the editor and must sign in again. All operators retain equal product access.</span></label>:null}
            <div className="mt-3 flex flex-wrap gap-3"><button className={button} disabled={busy||(operator.installationOwner&&!successorId)} onClick={()=>void remove(operator)}>Confirm removal</button><button className={button} disabled={busy} onClick={()=>setRemoving(null)}>Keep operator</button></div>
          </div>:null}
        </li>
      })}
    </ul>:null}
    <p className="text-sm text-penny-muted">Only the installation owner can leave as owner, by naming another verified operator to take over. Nobody else can remove the owner or take ownership. Branding and editor installation controls stay with the installation owner.</p>
  </section>
}
