import {useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {operatorMutation} from '../../requests/ui/operator-client'
import {buttonClass,fieldClass} from '../../auth/client-mutations'
import {fieldLabelClass,insetPanelClass,textLinkClass} from '@/core/ui/app/classes'
import {SectionCard} from '@/core/ui/app/SectionCard'
import {checkboxClass,checkRowClass} from '../../requests/ui/form-classes'
interface Key {id:string;name:string;scopes:string[];createdAt:number;expiresAt:number|null;revokedAt:number|null}
export function ApiKeys(){
 const [resource,reload]=useOperatorResource<{keys:Key[];scopes:string[]}>('/api/operator/integrations/keys'),[token,setToken]=useState(''),[message,setMessage]=useState('')
 async function create(form:HTMLFormElement){
  const input=new FormData(form),expiry=String(input.get('expiresAt')??'')
  try{
   const result=await operatorMutation('/api/operator/integrations/keys',{name:input.get('name'),scopes:input.getAll('scopes'),...(expiry?{expiresAt:new Date(expiry).getTime()}: {})}) as {token:string}
   setToken(result.token);setMessage('Save this key now. It is shown once.');form.reset();reload()
  }catch{setMessage('The key could not be created. Check its name, scopes, expiry and your session.')}
 }
 return <SectionCard id="api-keys-heading" icon="key" title="Scoped API keys" description="Keys use their issuing operator’s current authority. Public reads omit private feedback and account details. Publishing requires a write scope and explicit approval."><p role="status" className="text-base">{message}</p>
 {token?<div data-rer-private className="my-4"><label className={fieldLabelClass}>New key<input className={fieldClass} type="password" readOnly value={token}/></label><button className={`mt-3 min-h-11 ${textLinkClass}`} onClick={()=>{setToken('');setMessage('Key hidden. It cannot be revealed again.')}}>I saved the key</button></div>:null}
 {resource.kind==='ready'?<><form className="space-y-5" onSubmit={e=>{e.preventDefault();void create(e.currentTarget)}}><div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"><label className={fieldLabelClass}>Key name<input name="name" required maxLength={200} className={fieldClass}/></label><label className={fieldLabelClass}>Optional expiry<input name="expiresAt" type="datetime-local" className={fieldClass}/></label></div><fieldset><legend className={fieldLabelClass}>Scopes</legend><div className="mt-1 grid grid-cols-2 gap-x-4 lg:grid-cols-4">{resource.data.scopes.map(scope=><label key={scope} className={`${checkRowClass} font-normal`}><input type="checkbox" name="scopes" value={scope} className={checkboxClass}/>{scope}</label>)}</div></fieldset><button className={`${buttonClass} w-full sm:w-auto`}>Create API key</button></form>
 <ul className="mt-5 space-y-3">{resource.data.keys.map(key=><li key={key.id} className={`${insetPanelClass} break-words p-4`}><p className="font-bold">{key.name}</p><p className="text-base text-penny-muted">{key.scopes.join(', ')} · {key.revokedAt?'Revoked':key.expiresAt&&key.expiresAt<=Date.now()?'Expired':'Active'}</p>{!key.revokedAt?<button className={`min-h-11 ${textLinkClass}`} onClick={()=>{void operatorMutation('/api/operator/integrations/keys/'+key.id,{},'DELETE').then(()=>{reload();setMessage('Key revoked.')}).catch(()=>setMessage('Revocation failed. Retry after checking your session.'))}}>Revoke {key.name}</button>:null}</li>)}</ul></>:resource.kind==='loading'?<p>Loading API keys…</p>:<div><p role="alert">API keys could not be loaded. Sign in again if your session expired.</p><button className={`min-h-11 ${textLinkClass}`} onClick={reload}>Retry API keys</button></div>}
 </SectionCard>
}
