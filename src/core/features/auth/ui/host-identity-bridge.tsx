import {useEffect,useState} from 'react'
import {acceptHostIdentity,clearHostIdentity,hostRequesterName} from '../host-client'
export function HostIdentityBridge(){
 const [name,setName]=useState(''),[error,setError]=useState('')
 useEffect(()=>{
  let active=true,origins:string[]=[]
  const changed=()=>{if(active)setName(hostRequesterName())}
  const message=(event:MessageEvent)=>{
   if(event.source!==window.parent||!origins.includes(event.origin)||event.data?.type!=='penny-host-identity'||event.data?.version!==1)return
   void acceptHostIdentity(event.data).then(()=>{if(active)setError('')}).catch(()=>{if(active)setError('Host sign-in could not be confirmed. Verify your email to continue.')})
  }
  window.addEventListener('message',message);window.addEventListener('penny-requester-changed',changed);changed()
  void fetch('/api/public/identity/host/frames',{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('unavailable');return response.json() as Promise<{origins:string[]}>}).then(result=>{
   if(!active)return;origins=result.origins
   for(const origin of origins)window.parent.postMessage({type:'penny-host-ready',version:1},origin)
  }).catch(()=>{if(active&&window.parent!==window)setError('Host sign-in could not be configured. Verify your email to continue.')})
  return ()=>{active=false;window.removeEventListener('message',message);window.removeEventListener('penny-requester-changed',changed)}
 },[])
 return error?<p data-rer-private role="alert" className="mx-auto max-w-[1240px] px-4 pt-3 text-sm">{error} <a className="underline" href="/portal/feedback/new">Email verification</a></p>:name?<p data-rer-private className="mx-auto max-w-[1240px] px-4 pt-3 text-sm">Signed in as {name} <button className="ml-3 min-h-11 underline" onClick={clearHostIdentity}>Use email instead</button></p>:null
}
