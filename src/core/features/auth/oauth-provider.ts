import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from './native-tokens'
export const oauthProvider=z.enum(['google','github'])
export type OAuthProvider=z.infer<typeof oauthProvider>
export const oauthEndpoints={
 google:{authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',identity:'https://openidconnect.googleapis.com/v1/userinfo',scope:'openid email profile'},
 github:{authorize:'https://github.com/login/oauth/authorize',token:'https://github.com/login/oauth/access_token',identity:'https://api.github.com/user/emails',scope:'read:user user:email'},
} as const
export function oauthCredential(runtime:PennyRuntime,provider:OAuthProvider){
 const id=provider==='google'?runtime.bindings.REQUESTER_GOOGLE_CLIENT_ID:runtime.bindings.REQUESTER_GITHUB_CLIENT_ID
 const secret=provider==='google'?runtime.bindings.REQUESTER_GOOGLE_CLIENT_SECRET:runtime.bindings.REQUESTER_GITHUB_CLIENT_SECRET
 return id&&secret&&id.length<=1024&&secret.length<=4096&&!/[\r\n]/.test(id+secret)?{id,secret}:null
}
export async function oauthEnabled(runtime:PennyRuntime,provider:OAuthProvider){
 return !!oauthCredential(runtime,provider)&&!!runtime.bindings.PENNY_LEARNING_EGRESS&&!!await runtime.database.binding.prepare('SELECT 1 FROM penny_requester_oauth WHERE provider=? AND enabled=1').bind(provider).first()
}
export async function oauthIdentity(runtime:PennyRuntime,provider:OAuthProvider,code:string,verifier:string){
 const credentials=oauthCredential(runtime,provider),port=runtime.bindings.PENNY_LEARNING_EGRESS
 if(!credentials||!port)throw new NativeError('oauth_provider_unavailable',503)
 const endpoints=oauthEndpoints[provider],redirect=new URL(`/api/portal/oauth/${provider}/callback`,runtime.configuration.appOrigin).href
 const send=async(url:string,method:'POST'|'GET',body:string,headers:Record<string,string>)=>{
  let result:Awaited<ReturnType<typeof port.send>>
  try{result=await port.send({url,method,body,headers:{Accept:'application/json','User-Agent':'Penny',...headers}})}catch{throw new NativeError('oauth_provider_refused',503)}
  if(result.status!==200||typeof result.body!=='string'||new TextEncoder().encode(result.body).length>65536)throw new NativeError('oauth_provider_refused',503)
  try{return JSON.parse(result.body) as unknown}catch{throw new NativeError('oauth_provider_refused',503)}
 }
 const response=await send(endpoints.token,'POST',new URLSearchParams({client_id:credentials.id,client_secret:credentials.secret,code,redirect_uri:redirect,grant_type:'authorization_code',code_verifier:verifier}).toString(),{'Content-Type':'application/x-www-form-urlencoded'})
 const token=z.object({access_token:z.string().min(1).max(8192).regex(/^[^\r\n]+$/),token_type:z.string().refine(value=>value.toLowerCase()==='bearer')}).safeParse(response)
 if(!token.success)throw new NativeError('oauth_provider_refused',503)
 const identity=await send(endpoints.identity,'GET','',{Authorization:`Bearer ${token.data.access_token}`})
 const email=z.string().trim().toLowerCase().email().max(254)
 if(provider==='google'){
  const result=z.object({email,email_verified:z.boolean().optional(),hd:z.string().max(253).optional(),name:z.string().max(160).optional()}).safeParse(identity)
  if(!result.success)throw new NativeError('oauth_provider_identity_invalid',401)
  // Google vouches for an address's current owner only for Gmail and for a
  // Workspace account's own domain; any other address takes the emailed link.
  const domain=result.data.email.slice(result.data.email.lastIndexOf('@')+1),authoritative=domain==='gmail.com'||result.data.hd?.toLowerCase()===domain
  return {email:result.data.email,verified:result.data.email_verified===true&&authoritative,displayName:result.data.name??result.data.email.split('@')[0]}
 }
 const result=z.array(z.object({email,primary:z.boolean(),verified:z.boolean()})).max(100).safeParse(identity)
 if(!result.success)throw new NativeError('oauth_provider_identity_invalid',401)
 const primaries=result.data.filter(row=>row.primary)
 if(primaries.length!==1)return {email:null,verified:false,displayName:''}
 return {email:primaries[0].email,verified:primaries[0].verified,displayName:primaries[0].email.split('@')[0]}
}
