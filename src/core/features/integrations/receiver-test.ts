import {hmac} from '../../../../base/modules/integrations/core/crypto.ts'
import type {PennyRuntime} from '@/core/app/runtime'
import {destination,integrationOperator,keyBytes} from './destinations'
import {receiveWebhook} from './receiver'
import {RECEIVER_EVENT,RECEIVER_TENANT,signedText} from './receiver-protocol'

/** Signs one sample note with the receiver's own key and delivers it through
 * the same receiver an outside tool reaches, so the result is the real one. */
export async function sendTestNote(runtime:PennyRuntime,request:Request,id:string,requestId:string){
 await integrationOperator(runtime,request)
 const target=await destination(runtime,id,'receiver')
 const body=JSON.stringify({requestId,note:`Test note from the “${target.name}” receiver: Penny signed this sample itself to check the connection.`})
 const noteId='penny-test-'+crypto.randomUUID(),timestamp=String(Math.floor(Date.now()/1000))
 const signature=await hmac(keyBytes(target.signing_key!),signedText(id,noteId,timestamp,body))
 return receiveWebhook(runtime,new Request(`${runtime.configuration.appOrigin}/api/integrations/webhooks/${id}`,{method:'POST',body,headers:{
  'content-type':'application/json','webhook-id':noteId,'webhook-tenant':RECEIVER_TENANT,'webhook-destination':id,'webhook-event':RECEIVER_EVENT,'webhook-timestamp':timestamp,'webhook-signature':'v1='+signature,
 }}),id)
}
