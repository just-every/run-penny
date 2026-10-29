import {EmailCaptureSettings} from './email-capture-settings'
import {useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {operatorMutation} from '../../requests/ui/operator-client'
import {buttonClass,fieldClass} from '../../auth/client-mutations'
import {fieldLabelClass,textLinkClass} from '@/core/ui/app/classes'
import {SectionCard} from '@/core/ui/app/SectionCard'
import type {MailIdentity} from '../mail-identity'
export function MailIdentitySettings(){
 const [resource,reload]=useOperatorResource<{identity:MailIdentity;owner:boolean;providerTestAvailable:boolean;mailSuppressed:boolean}>('/api/operator/settings/mail')
 return <SectionCard id="mail-identity" icon="form" title="Email identity and postal address" description="Confirm the business address shown in customer email and test the sender with your mail provider.">{resource.kind==='ready'?resource.data.owner?<><IdentityForm key={JSON.stringify(resource.data.identity)} {...resource.data} reload={reload}/><EmailCaptureSettings/></>:<p>Owner access is required to configure email identity.</p>:resource.kind==='loading'?<p>Loading email settings…</p>:<><p role="alert">Email settings could not be loaded.</p><button className={textLinkClass} onClick={reload}>Retry</button></>}</SectionCard>
}
function IdentityForm({identity,providerTestAvailable,mailSuppressed,reload}:{identity:MailIdentity;providerTestAvailable:boolean;mailSuppressed:boolean;reload:()=>void}){
 const [message,setMessage]=useState(''),[test,setTest]=useState<{testId:string;accepted:boolean;message:string}|null>(null),[busy,setBusy]=useState(false)
 const values=(form:HTMLFormElement)=>{const data=new FormData(form);return {companyName:String(data.get('companyName')),postalAddress:String(data.get('postalAddress')),senderName:String(data.get('senderName')),fromAddress:String(data.get('fromAddress')),replyTo:String(data.get('replyTo')??'').trim()||null}}
 return <form className="space-y-5" onChange={()=>setTest(null)} onSubmit={async event=>{event.preventDefault();const form=event.currentTarget;if(!mailSuppressed&&!test?.accepted)return;setBusy(true);try{const testId=mailSuppressed?((await operatorMutation('/api/operator/settings/mail/test',values(form))) as {testId:string}).testId:test!.testId;await operatorMutation('/api/operator/settings/mail',{...values(form),testId,acceptProviderResult:true},'PUT');setMessage('Email identity saved.');window.dispatchEvent(new Event('penny-mail-identity-changed'));reload()}catch(error){setMessage(error instanceof Error?error.message:'Could not save email identity.')}finally{setBusy(false)}}}>
  <label className={fieldLabelClass}>Company name<input name="companyName" required maxLength={160} defaultValue={identity.companyName} className={fieldClass}/></label>
  <label className={fieldLabelClass}>Business postal address<textarea name="postalAddress" required maxLength={2000} defaultValue={identity.postalAddress} className={fieldClass}/></label>
  <p className="text-sm">Voting and submitting can subscribe customers only after this postal address is recorded. Existing installations must confirm their address once.</p>
  <button type="button" className={buttonClass} disabled={busy} onClick={async e=>{const form=e.currentTarget.form!;if(!form.elements.namedItem('companyName')||!form.querySelector<HTMLInputElement>('[name=companyName]')!.reportValidity()||!form.querySelector<HTMLTextAreaElement>('[name=postalAddress]')!.reportValidity())return;setBusy(true);try{const input=values(form);await operatorMutation('/api/operator/settings/business',{companyName:input.companyName,postalAddress:input.postalAddress,confirmPostalAddress:true},'PUT');setMessage('Business postal address confirmed.');window.dispatchEvent(new Event('penny-mail-identity-changed'));reload()}catch(error){setMessage(error instanceof Error?error.message:'Could not confirm address.')}finally{setBusy(false)}}}>Confirm company and postal address</button>
  <label className={fieldLabelClass}>Sender name (defaults to company name)<input name="senderName" maxLength={160} defaultValue={identity.senderName} className={fieldClass}/></label>
  <label className={fieldLabelClass}>Provider verified from address<input name="fromAddress" type="email" required maxLength={254} defaultValue={identity.fromAddress??''} className={fieldClass}/></label>
  <label className={fieldLabelClass}>Monitored reply-to (optional)<input name="replyTo" type="email" maxLength={254} defaultValue={identity.replyTo??''} className={fieldClass}/></label>
  <p className="text-sm">Leave reply-to empty to use the no-reply sender. Replies never create feedback records.</p>
  {!providerTestAvailable&&!mailSuppressed?<p role="status">Sender testing is unavailable. Configure SendGrid or Resend before changing sender identity.</p>:null}
  {mailSuppressed?<button disabled={busy} className={buttonClass}>Save email identity</button>:<><button type="button" disabled={busy||!providerTestAvailable} className={buttonClass} onClick={async e=>{const form=e.currentTarget.form!;if(!Array.from(form.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('input[name],textarea[name]')).every(input=>input.reportValidity()))return;setBusy(true);setTest(null);try{const result=await operatorMutation('/api/operator/settings/mail/test',values(form)) as {testId:string;accepted:boolean;message:string};setTest(result);setMessage(result.message)}catch(error){setMessage(error instanceof Error?error.message:'Could not send the test.')}finally{setBusy(false)}}}>Send test to my operator email</button></>}
  {!mailSuppressed&&test?.accepted?<><p>{test.message}</p><label className="flex min-h-11 items-center gap-2"><input type="checkbox" required onChange={e=>e.stopPropagation()}/>I received the test and accept this sender.</label><button disabled={busy} className={buttonClass}>Save tested email identity</button></>:null}
  <p role="status">{message}</p>
 </form>
}
