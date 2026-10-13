/** Called only from Base's authorize callback, after Base verifies original bytes.
 * This extracts provider-specific policy fields; it never normalizes/authenticates
 * an event. Exact slice fingerprint equality binds those fields to Base's event. */
interface Policy {fingerprint:string;attemptId:string|null;suppress:boolean}
export function originalPolicyReader(raw:Uint8Array,provider:string){
 let policies:Promise<Policy[]>|undefined
 return async(fingerprint:string)=>{
  policies??=readOriginalPolicies(raw,provider)
  const policy=(await policies).find(row=>row.fingerprint===fingerprint)
  if(!policy)throw new Error('event_fingerprint_mismatch')
  return policy
 }
}
async function readOriginalPolicies(raw:Uint8Array,provider:string):Promise<Policy[]>{
 const text=new TextDecoder('utf-8',{fatal:true}).decode(raw)
 const slices:string[]=[]
 if(provider==='resend')slices.push(text)
 else {
  let depth=0,start=0,quoted=false,escaped=false
  for(let i=0;i<text.length;i++){
   const c=text[i]
   if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}
   if(c==='"')quoted=true
   else if(c==='{'||c==='['){if(depth===1)start=i;depth++}
   else if(c==='}'||c===']'){depth--;if(depth===1)slices.push(text.slice(start,i+1))}
  }
 }
 return Promise.all(slices.map(async slice=>{
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(slice))),b=>b.toString(16).padStart(2,'0')).join('')
  const value=JSON.parse(slice)
  return {fingerprint:hash,attemptId:typeof value.rer_penny_attempt==='string'?value.rer_penny_attempt:null,
   suppress:provider==='sendgrid'?(value.event==='spamreport'||(value.event==='bounce'&&value.type==='bounce')):
    (value.type==='email.complained'||(value.type==='email.bounced'&&value.data?.bounce?.type==='Permanent'))}
 }))
}
