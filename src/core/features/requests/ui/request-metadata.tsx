import { useState } from 'react'
import { fieldLabelClass, primaryButtonClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { checkboxClass, subformClass } from './form-classes'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import { operatorMutation } from './operator-client'
export function RequestMetadata({requestId}:{requestId:string}) {
 const [catalog]=usePublicResource<{tags:{id:string;name:string}[]}>('/api/operator/catalog/settings')
 const [fields,refresh]=usePublicResource<{id:string;name:string;fieldType:string;value:unknown}[]>(`/api/operator/custom-fields/request/${requestId}`),[message,setMessage]=useState('')
 async function act(path:string,body:unknown,method:string){try{await operatorMutation(path,body,method);setMessage('Saved.');refresh()}catch(e){setMessage(e instanceof Error?e.message:'Could not save.')}}
 return <section className={`${subformClass} space-y-4`}><h3 className="font-bold text-penny-ink">Private request context</h3><p className="text-sm font-semibold text-penny-ink empty:hidden" role="status">{message}</p>
 <form className="space-y-3" onSubmit={e=>{e.preventDefault();const tag=new FormData(e.currentTarget).get('tag');void act(`/api/operator/catalog/requests/${requestId}/tags/${tag}`,{},'PUT')}}><label className={fieldLabelClass}>Apply tag<select name="tag" className={fieldClass} required defaultValue=""><option value="" disabled>Select a private tag</option>{catalog.kind==='ready'?catalog.data.tags.map(t=><option key={t.id} value={t.id}>{t.name}</option>):null}</select></label><button className={primaryButtonClass}>Apply tag</button></form>
 {fields.kind==='ready'?fields.data.map(field=>{const boolean=field.fieldType==='boolean';return <form className="space-y-3" key={field.id} onSubmit={e=>{e.preventDefault();const raw=new FormData(e.currentTarget).get('value');const value=field.fieldType==='boolean'?raw==='on':field.fieldType==='number'?Number(raw):raw;void act(`/api/operator/custom-fields/${field.id}/${requestId}`,{value},'PUT')}}><label className={boolean?'flex min-h-11 items-center gap-3 text-sm font-bold text-penny-ink':fieldLabelClass}>{field.name}<input name="value" type={boolean?'checkbox':field.fieldType==='number'?'number':field.fieldType==='date'?'date':'text'} defaultChecked={field.value===true} defaultValue={boolean?undefined:String(field.value??'')} className={boolean?checkboxClass:fieldClass}/></label><button className={secondaryButtonClass}>Save field</button></form>}):null}
 </section>
}
