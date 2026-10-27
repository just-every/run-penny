import { actionMessage } from '@/core/shared/action-message'
export async function operatorMutation(path:string,body:unknown,method='POST') {
  const response=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  if(!response.ok)throw new Error(actionMessage(await response.json().catch(()=>null),response.status))
  return response.status===204?null:response.json()
}
