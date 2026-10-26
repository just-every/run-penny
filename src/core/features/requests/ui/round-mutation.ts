export interface RoundMutationFailure {
 message:string
 action:'retry'|'reload'|null
}
class Refusal extends Error {
 constructor(readonly failure:RoundMutationFailure){super(failure.message)}
}
/** Only the scorecard forms and identity merge door need refusal-specific recovery. */
export async function roundMutation<T=unknown>(path:string,body:unknown,method='POST'):Promise<T>{
 const response=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 if(!response.ok){
  if(response.status>=500)throw new Error('Server unavailable')
  const result=await response.json().catch(()=>null) as {message?:unknown}|null
  const message=typeof result?.message==='string'?result.message:response.statusText
  throw new Refusal({message,action:response.status===409?'reload':null})
 }
 return response.status===204?null as T:response.json() as Promise<T>
}
export function roundMutationFailure(error:unknown,transportMessage:string):RoundMutationFailure{
 return error instanceof Refusal?error.failure:{message:transportMessage,action:'retry'}
}
