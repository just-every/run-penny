import {hostRequesterHeaders} from './host-client'
import { inputClass, primaryButtonClass } from '@/core/ui/app/classes'
export const fieldClass=`mt-2 text-base ${inputClass}`
export const buttonClass=primaryButtonClass
export async function postJson<T>(path:string,body:unknown,token?:string):Promise<T>{
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:path.startsWith('/api/public/requests')?hostRequesterHeaders():{})},body:JSON.stringify(body)})
  if(!response.ok){const result=await response.json() as {error?:string};throw new Error(result.error==='mail_unavailable'?'Penny could not send the email. Try again, or check the mail settings.':result.error==='requester_verification_required'?'Verify your email address before submitting.':result.error==='rate_limited'?'Too many attempts. Please wait before retrying.':result.error==='unauthenticated'?'Your operator session has expired. Sign in again.':result.error==='idempotency_conflict'?'This saved submission key has different content. Start a new submission.':result.error==='invalid_magic_link'?'This link has expired or has already been used. Request a new link.':result.error==='board_unavailable'?'This board is unavailable. Choose another board.':result.error==='moderation_conflict'?'This request has already been reviewed or is unavailable. Refresh the queue.':'Penny could not complete this action. Please retry.')}
  if(path==='/api/auth/sign-out')window.dispatchEvent(new Event('penny-authority-changed'))
  return response.status===204?undefined as T:await response.json() as T
}
export const requesterStorageKey='penny_requester_session'

export function requesterHeaders():Record<string,string> {
 const host=hostRequesterHeaders()
 if(Object.keys(host).length)return host
 const token=localStorage.getItem(requesterStorageKey)
 return token?{Authorization:`Bearer ${token}`}:{ }
}
