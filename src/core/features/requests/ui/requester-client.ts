import { requesterHeaders } from '@/core/features/auth/client-mutations'
import { actionMessage } from '@/core/shared/action-message'
export async function requesterMutation(path:string, method:string, body?:unknown) {
  const headers=requesterHeaders()
  if(!Object.keys(headers).length)throw new Error('Verify your email before taking part.')
  const response=await fetch(path,{method,headers:{...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)})
  if(!response.ok)throw new Error(actionMessage(await response.json().catch(()=>null),response.status))
  return response.status===204?null:response.json()
}
