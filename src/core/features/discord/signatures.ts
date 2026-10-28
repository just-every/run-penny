import {NativeError} from '../auth/native-tokens'
const bytes=(hex:string)=>Uint8Array.from(hex.match(/../g)??[],value=>parseInt(value,16))
const encoder=new TextEncoder()
export async function verifyDiscord(request:Request,raw:Uint8Array,key:string,relay=false){
 const timestamp=request.headers.get(relay?'X-Penny-Timestamp':'X-Signature-Timestamp')??'',signature=request.headers.get(relay?'X-Penny-Signature':'X-Signature-Ed25519')??''
 if(!/^[0-9]{10}$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300||!(relay?/^[a-f0-9]{64}$/i:/^[a-f0-9]{128}$/i).test(signature))throw new NativeError('discord_signature_invalid',401)
 const prefix=encoder.encode(timestamp),message=new Uint8Array(prefix.length+raw.length);message.set(prefix);message.set(raw,prefix.length)
 const imported=relay?await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['verify']):await crypto.subtle.importKey('raw',bytes(key),{name:'Ed25519'},false,['verify'])
 if(!await crypto.subtle.verify(relay?'HMAC':'Ed25519',imported,bytes(signature),message))throw new NativeError('discord_signature_invalid',401)
}
