import {useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {operatorMutation} from '../../requests/ui/operator-client'
import {SectionCard} from '@/core/ui/app/SectionCard'
import {buttonClass} from '../client-mutations'
export function RequesterOAuthSettings(){
 const [resource,reload]=useOperatorResource<{canConfigure:boolean;providers:{provider:'google'|'github';enabled:boolean;available:boolean}[]}>('/api/operator/settings/requester-oauth')
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 return <SectionCard id="requester-oauth" icon="form" title="Requester social sign-in" description="Google and GitHub identify requesters only. Sign-in grants no operator access or email subscription.">
 {resource.kind==='ready'&&resource.data.canConfigure?<form key={JSON.stringify(resource.data)} className="space-y-4" onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);try{await operatorMutation('/api/operator/settings/requester-oauth',{google:data.has('google'),github:data.has('github')},'PUT');setMessage('Requester sign-in settings saved.');reload()}catch(error){setMessage(error instanceof Error?error.message:'Could not save.')}finally{setBusy(false)}}}>
 {resource.data.providers.map(provider=><div key={provider.provider}><label className="flex min-h-11 items-center gap-2"><input type="checkbox" name={provider.provider} defaultChecked={provider.enabled}/>Continue with {provider.provider==='google'?'Google':'GitHub'}</label>{!provider.available?<p className="text-sm">Installation client credentials and enforcing egress must be configured before this provider can be enabled.</p>:null}</div>)}
 <button className={buttonClass} disabled={busy}>Save social sign-in settings</button>
 </form>:<p>{resource.kind==='loading'?'Loading requester sign-in settings…':'Owner access is required to configure requester sign-in.'}</p>}
 <p role="status" className="mt-4">{message}</p>
 </SectionCard>
}
