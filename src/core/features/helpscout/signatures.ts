import {NativeError} from '../auth/native-tokens'
import {boundedRawBody} from '../integrations/raw-body'
/** Help Scout's documented HMAC-SHA1 over the exact raw body, base64 encoded. */
export async function signedBody(request:Request,secret:string):Promise<unknown>{
 const bytes=await boundedRawBody(request,32768),signature=request.headers.get('X-HelpScout-Signature')??''
 if(!/^[A-Za-z0-9+/]{27}=$/.test(signature))throw new NativeError('helpscout_signature_invalid',401)
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-1'},false,['verify'])
 if(!await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(signature),c=>c.charCodeAt(0)),new Uint8Array(bytes)))throw new NativeError('helpscout_signature_invalid',401)
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new NativeError('helpscout_payload_invalid',400)}
}
