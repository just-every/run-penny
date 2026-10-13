import { useState } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorOptionsState } from '@/core/app/ui/operator-options-state'
import { OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { Field, LoopForm } from '@/core/app/ui/loop-form'
import { disclosureSummaryClass, fieldLabelClass, fileInputClass, primaryButtonClass, textLinkClass } from '@/core/ui/app/classes'

import type { EvidenceVersion, EvidenceAttachments } from '../types'

async function confirmAttachmentResponse(response:Response,failureMessage:string){
 const result:unknown=await response.json()
 if(typeof result!=='object'||result===null||!('id' in result)||typeof result.id!=='string'||!result.id.trim())throw new Error(failureMessage)
}

export function EvidenceHistory({id,onSaved}:{id:string;onSaved:()=>void}) {
 const base=`/api/operator/evidence/${id}`
 const [versions,reloadVersions]=useOperatorResource<EvidenceVersion[]>(`${base}/versions`)
 const [files,reloadFiles]=useOperatorResource<EvidenceAttachments>(`${base}/attachments`)
 const [message,setMessage]=useState(''),[failed,setFailed]=useState(false),[busy,setBusy]=useState(false),[sessionExpired,setSessionExpired]=useState(false)
 const current=versions.kind==='ready'?versions.data[0]:null
 return <details className="group mt-4 border-t border-penny-line"><summary className={disclosureSummaryClass}>Wording history and private files</summary><div className="mt-3 space-y-4">
 <OperatorOptionsState state={versions} loading="Loading wording history…" failure="Could not load wording history." reload={reloadVersions}/>
 {current?<LoopForm key={current.id} title="Edit evidence wording" action={`${base}/wording`} method="PATCH" submit="Save new version" onSaved={()=>{reloadVersions();onSaved()}} transform={data=>({wording:data.get('wording'),expectedVersionId:current.id})}><Field name="wording" label="Evidence wording" value={current.wording} type="textarea" required/><p className="text-sm text-penny-muted">Earlier wording stays readable here. This history is operator-only.</p></LoopForm>:null}
 {versions.kind==='ready'?<section aria-label="Evidence wording versions" className="space-y-3">{versions.data.map((version,index)=><article key={version.id} className="border-t border-penny-line pt-3"><h4 className="text-sm font-bold text-penny-ink">{index===0?'Current wording':'Earlier wording'} · <time dateTime={version.createdAt}>{version.createdAt}</time></h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{version.wording}</p></article>)}</section>:null}
 <h3 className="font-bold text-penny-ink">Operator-only attachments</h3><OperatorOptionsState state={files} loading="Loading private attachments…" failure="Could not load private attachments." reload={reloadFiles}/>
 {files.kind==='ready'?files.data.files.length?<ul className="space-y-2">{files.data.files.map(file=><li key={file.id}><a className={`${textLinkClass} inline-flex min-h-11 items-center break-all`} href={`/api/operator/evidence-attachments/${file.id}`}>{file.filename}</a><span className="ml-2 text-xs text-penny-muted">{file.byteSize.toLocaleString()} bytes</span></li>)}</ul>:<p className="text-sm text-penny-muted">No private files attached.</p>:null}
 {files.kind==='ready'?files.data.uploads.map(upload=><div key={upload.id} className="space-y-3 border-t border-penny-line pt-3"><p className="text-sm">Interrupted upload: {upload.filename}{upload.writing?' · writer still held':''}</p>{upload.writing?<LoopForm title="Release interrupted upload writer" action={`/api/operator/evidence-uploads/${upload.id}/release-writer`} submit="Release writer" onSaved={reloadFiles} transform={()=>({confirmPriorWriterStopped:true})}><label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1 size-4"/>I confirmed the prior upload writer has stopped.</label></LoopForm>:<EvidenceUploadRecovery id={upload.id} onSaved={reloadFiles}/>}</div>):null}
 <form aria-label="Attach evidence file" className="space-y-3" onSubmit={async event=>{event.preventDefault();if(busy||sessionExpired)return;const form=event.currentTarget;setBusy(true);setMessage('');setFailed(false);try{const response=await fetch(`${base}/attachments`,{method:'POST',body:new FormData(form)});if(response.status===401){setSessionExpired(true);return}if(!response.ok){const result=await response.json() as {error?:string};throw new Error(result.error?.replaceAll('_',' ')??'File upload failed.')}await confirmAttachmentResponse(response,'File upload completion could not be confirmed. Keep the original file.');form.reset();setMessage('Private file attached.');reloadFiles()}catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'File upload failed.')}finally{setBusy(false)}}}><label className={fieldLabelClass}>Evidence file<input className={fileInputClass} type="file" name="file" accept="image/png,image/jpeg,image/gif,application/pdf" required/></label><p className="text-sm text-penny-muted">PNG, JPEG, GIF or PDF, up to 10 MB. Files require an operator session even when linked feedback is published.</p><button className={primaryButtonClass} disabled={busy||sessionExpired}>{busy?'Uploading…':'Attach private file'}</button>{sessionExpired?<OperatorSessionExpired/>:message?<p role={failed?'alert':'status'} className="break-words text-sm">{message}</p>:null}</form>
 </div></details>
}

function EvidenceUploadRecovery({id,onSaved}:{id:string;onSaved:()=>void}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[sessionExpired,setSessionExpired]=useState(false)
 return <form aria-label="Recover evidence upload" className="space-y-3" onSubmit={async event=>{event.preventDefault();if(busy||sessionExpired)return;setBusy(true);setMessage('');setFailed(false);try{const data=new FormData(event.currentTarget);const file=data.get('file');const response=await fetch(`/api/operator/evidence-uploads/${id}/recover`,{method:'POST',...(file instanceof File&&file.size?{body:data}:{})});if(response.status===401){setSessionExpired(true);return}if(!response.ok)throw new Error('Upload recovery failed. Keep the original file and retry.');await confirmAttachmentResponse(response,'Upload recovery completion could not be confirmed. Keep the original file.');onSaved();setMessage('Upload recovered.')}catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'Recovery failed.')}finally{setBusy(false)}}}><label className={fieldLabelClass}>Original file (if requested)<input name="file" type="file" className={fileInputClass}/></label><button className={primaryButtonClass} disabled={busy||sessionExpired}>{busy?'Recovering…':'Recover upload'}</button>{sessionExpired?<OperatorSessionExpired/>:message?<p role={failed?'alert':'status'} className="text-sm">{message}</p>:null}</form>
}
