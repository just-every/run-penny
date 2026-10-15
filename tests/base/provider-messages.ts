import type {PennyRuntime} from '@/core/app/runtime'
import {vi} from 'vitest'

/** Inspect only the test's SendGrid HTTP edge, never an application inbox. */
export function providerMessages(runtime?:PennyRuntime){
 return {list:async()=>vi.mocked(fetch).mock.calls.flatMap(([input,init],index)=>{
  if(String(input)!=='https://api.sendgrid.com/v3/mail/send')return []
  const body=JSON.parse(String(init?.body))
  if(runtime?.configuration.appOrigin&&!String(init?.body).includes(runtime.configuration.appOrigin))return []
  const content=(type:string)=>body.content.find((part:{type:string})=>part.type===type)?.value
  return [{id:String(index),message:{deliveryId:body.custom_args.rer_delivery_id,to:body.personalizations[0].to.map((to:{email:string})=>to.email),subject:body.subject,text:content('text/plain') as string,html:content('text/html') as string|undefined}}]
 }).reverse()}
}
