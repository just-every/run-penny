export interface RoundMutationFailure {
 message:string
 action:'retry'|'reload'|'sign_in'|null
}
class Refusal extends Error {
 readonly status:number
 readonly serverMessage:string|null
 constructor(status:number,serverMessage:string|null){super(serverMessage??`Refused with ${status}`);this.status=status;this.serverMessage=serverMessage}
}
/** Only the scorecard forms and identity merge door need refusal-specific recovery. */
export async function roundMutation<T=unknown>(path:string,body:unknown,method='POST'):Promise<T>{
 const response=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 if(!response.ok){
  if(response.status>=500)throw new Error('Server unavailable')
  const result=await response.json().catch(()=>null) as {message?:unknown}|null
  throw new Refusal(response.status,typeof result?.message==='string'&&result.message.trim()?result.message:null)
 }
 return response.status===204?null as T:response.json() as Promise<T>
}
/** A refusal shows the server's words, or else the door's own line; only transport errors and 5xx offer Retry. */
export function roundMutationFailure(error:unknown,doorLine:string):RoundMutationFailure{
 if(!(error instanceof Refusal))return {message:`${doorLine} Try again.`,action:'retry'}
 if(error.status===401)return {message:'Your operator session has expired.',action:'sign_in'}
 return {message:error.serverMessage??doorLine,action:error.status===409?'reload':null}
}
