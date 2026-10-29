import {NativeError} from '../auth/native-tokens'
export async function verifySurvey(request:Request,body:Uint8Array,provider:string,secret:string,clientId?:string){
 const name=provider==='typeform'?'Typeform-Signature':provider==='surveymonkey'?'Sm-Signature':'Pencil-Signature'
 const signature=request.headers.get(name)??''
 if(provider==='surveymonkey'&&request.headers.get('Sm-Apikey')!==clientId)throw new NativeError('survey_signature_invalid',401)
 let bytes:Uint8Array
 try{
  if(provider==='pencil'){
   if(!/^sha256=[a-f0-9]{64}$/i.test(signature))throw Error()
   bytes=Uint8Array.from(signature.slice(7).match(/../g)!,s=>parseInt(s,16))
  }else{
   const value=provider==='typeform'?signature.replace(/^sha256=/,''):signature
   if(provider==='typeform'&&!signature.startsWith('sha256='))throw Error()
   bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0))
   if(bytes.length!==(provider==='surveymonkey'?20:32))throw Error()
  }
 }catch{throw new NativeError('survey_signature_invalid',401)}
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(provider==='surveymonkey'?clientId+'&'+secret:secret),{name:'HMAC',hash:provider==='surveymonkey'?'SHA-1':'SHA-256'},false,['verify'])
 if(!await crypto.subtle.verify('HMAC',key,new Uint8Array(bytes),new Uint8Array(body)))throw new NativeError('survey_signature_invalid',401)
}
