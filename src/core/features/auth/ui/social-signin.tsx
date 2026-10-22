import {useState} from 'react'
import {usePublicResource} from '../../portal/ui/public-resource'
import {buttonClass} from '../../portal/ui/portal-classes'
import {postJson} from '../client-mutations'
import {opaqueToken} from '../native-tokens'
import {pendingRequesterToken} from '../requester-pending'
export function SocialSignIn(){
 const [resource]=usePublicResource<{providers:('google'|'github')[]}>('/api/portal/oauth/providers'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 if(resource.kind!=='ready'||!resource.data.providers.length)return null
 async function start(provider:'google'|'github'){
  setBusy(true);setMessage('')
  try{
   const verifier=opaqueToken(),bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))),challenge=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
   const result=await postJson<{url:string;state:string}>(`/api/portal/oauth/${provider}/start`,{challenge,pendingToken:pendingRequesterToken()})
   sessionStorage.setItem('penny_oauth_'+result.state,verifier)
   location.assign(result.url)
  }catch(error){setMessage(error instanceof Error?error.message:'Could not start sign-in.');setBusy(false)}
 }
 return <div className="mt-5 space-y-3"><div className="flex flex-wrap gap-3">{resource.data.providers.map(provider=><button key={provider} type="button" className={buttonClass} disabled={busy} onClick={()=>void start(provider)}>Continue with {provider==='google'?'Google':'GitHub'}</button>)}</div><p role="status">{message}</p></div>
}
