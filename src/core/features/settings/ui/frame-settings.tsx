import {useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {operatorMutation} from '../../requests/ui/operator-client'
import {buttonClass,fieldClass} from '../../auth/client-mutations'
import {fieldLabelClass,textLinkClass} from '@/core/ui/app/classes'
import {SectionCard} from '@/core/ui/app/SectionCard'

export function FrameSettings(){
 const [resource,reload]=useOperatorResource<{publicOriginAllowlist:string[]}>('/api/operator/settings/frames')
 const [message,setMessage]=useState(''),[saving,setSaving]=useState(false)
 return <SectionCard id="frame-settings-heading" icon="settings" title="Portal embedding" description="Allow these websites to embed your public portal. Enter one exact HTTPS origin per line, with no path. Leave empty to prevent other websites embedding it.">
  {resource.kind==='ready'?<form aria-label="Portal embedding" className="space-y-5" onSubmit={event=>{
   event.preventDefault();const values=new FormData(event.currentTarget)
   const publicOriginAllowlist=String(values.get('origins')??'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean)
   setSaving(true);setMessage('')
   void operatorMutation('/api/operator/settings/frames',{publicOriginAllowlist},'PUT').then(()=>{setMessage('Portal embedding saved.');reload()}).catch(()=>setMessage('Could not save. Use at most ten exact HTTPS origins and check your operator access.')).finally(()=>setSaving(false))
  }}><label className={fieldLabelClass}>Allowed parent origins<textarea key={resource.data.publicOriginAllowlist.join(' ')} name="origins" rows={4} defaultValue={resource.data.publicOriginAllowlist.join('\n')} placeholder="https://app.example.com" className={fieldClass}/></label><button disabled={saving} className={buttonClass}>{saving?'Saving…':'Save portal embedding'}</button></form>:resource.kind==='loading'?<p>Loading portal embedding…</p>:<><p role="alert">Portal embedding could not be loaded.</p><button onClick={reload} className={`min-h-11 ${textLinkClass}`}>Retry portal embedding</button></>}
  {message?<p role="status" className="mt-4">{message}</p>:null}
 </SectionCard>
}
