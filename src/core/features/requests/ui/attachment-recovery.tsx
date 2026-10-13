import { useState } from 'react'
import { fieldLabelClass, primaryButtonClass } from '@/core/ui/app/classes'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { checkboxClass, checkRowClass, subformClass } from './form-classes'

export function AttachmentRecovery({upload,onRecovered}:{upload:{id:string;original_filename:string;writing:number};onRecovered:()=>void}) {
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[released,setReleased]=useState(false)
 return <form className={`${subformClass} space-y-3`} onSubmit={async event=>{
  event.preventDefault();setBusy(true);setMessage('')
  const data=new FormData(event.currentTarget),file=data.get('file'),hasFile=file instanceof File&&file.size>0
  const uploadData=new FormData();if(hasFile)uploadData.set('file',file)
  try{
   if(upload.writing&&!released){
    const release=await fetch(`/api/operator/attachment-uploads/${upload.id}/release-writer`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({priorWriterStopped:data.get('stopped')==='on'})})
    if(!release.ok)throw new Error('Confirm the previous upload process is stopped before recovery.')
    setReleased(true)
   }
   const response=await fetch(`/api/operator/attachment-uploads/${upload.id}/recover`,{method:'POST',...(hasFile?{body:uploadData}:{headers:{'Content-Type':'application/json'},body:'{}'})})
   if(!response.ok){const result=await response.json() as {error?:string};throw new Error(result.error?.replaceAll('_',' ')??'Recovery failed')}
   onRecovered()
  }catch(error){setMessage(error instanceof Error?error.message:'Recovery failed')}finally{setBusy(false)}
 }}><p className="font-semibold text-penny-ink">Unfinished upload: {upload.original_filename}</p>
 {upload.writing&&!released?<label className={`${checkRowClass} items-start`}><input name="stopped" type="checkbox" required className={`${checkboxClass} mt-2.5`}/> I stopped the previous upload process and confirmed it can no longer write files.</label>:null}
 <label className={fieldLabelClass}>Original file (only if stored bytes are missing)<input name="file" type="file" className={fieldClass}/></label>
 <p className="text-sm text-penny-muted">Recovery verifies the original file’s size and fingerprint before completing its private metadata.</p>
 <button className={primaryButtonClass} disabled={busy}>Verify and recover upload</button><p role="status" className="text-sm font-semibold text-penny-danger empty:hidden">{message}</p>
 </form>
}
