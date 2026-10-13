// Synthetic provider signing identity exists only in tests; no network provider calls.
export async function signingIdentity(){
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']) as CryptoKeyPair
 const key=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('spki',pair.publicKey))))
 return {key,async request(events:unknown[],timestamp=Math.floor(Date.now()/1000)){
  const body=JSON.stringify(events),bytes=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(String(timestamp)+body)))
  const integer=(part:Uint8Array)=>{let n=0;while(n<part.length-1&&part[n]===0)n++;const data=[...part.slice(n)];if(data[0]&128)data.unshift(0);return [2,data.length,...data]}
  const components=[...integer(bytes.slice(0,32)),...integer(bytes.slice(32))]
  return new Request('https://penny.test/api/public/mail/events',{method:'POST',body,headers:{'Content-Type':'application/json','x-twilio-email-event-webhook-timestamp':String(timestamp),'x-twilio-email-event-webhook-signature':btoa(String.fromCharCode(48,components.length,...components))}})
 }}
}
