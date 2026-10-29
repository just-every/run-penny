import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
import {guardedDatabase} from '../integrations/guarded-database'
import {credentialInput,type Credential} from './credential-schema'
import {wire,type Connection} from './configuration'
async function key(runtime:PennyRuntime){if(!runtime.bindings.AUTH_SECRET||runtime.bindings.AUTH_SECRET.length<32)throw new NativeError('reviews_encryption_unconfigured',503);return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode('penny-review-credentials-v1:'+runtime.bindings.AUTH_SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes))
const decode=(text:string)=>Uint8Array.from(atob(text),c=>c.charCodeAt(0))
export async function seal(runtime:PennyRuntime,id:string,token:string){const iv=crypto.getRandomValues(new Uint8Array(12));return encode(iv)+'.'+encode(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},await key(runtime),new TextEncoder().encode(token))))}
async function open(runtime:PennyRuntime,id:string,encrypted:string){try{const [iv,body]=encrypted.split('.');return new TextDecoder('utf-8',{fatal:true}).decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:new TextEncoder().encode(id)},await key(runtime),decode(body)))}catch{throw new NativeError('reviews_credentials_unreadable',503)}}
const base64url=(bytes:Uint8Array)=>encode(bytes).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
async function jwt(credential:Extract<Credential,{kind:'appstore'|'googleplay'}>){
 const apple=credential.kind==='appstore',algorithm=apple?{name:'ECDSA',namedCurve:'P-256'}:{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},now=Math.floor(Date.now()/1000)
 let signingKey:CryptoKey
 try{signingKey=await crypto.subtle.importKey('pkcs8',decode(credential.privateKey.replace(/-----[^-]+-----|\s/g,'')),algorithm,false,['sign'])}catch{throw new NativeError('reviews_signing_key_invalid',400)}
 const header={alg:apple?'ES256':'RS256',typ:'JWT',...(apple?{kid:credential.keyId}:{})},payload=apple?{iss:credential.issuerId,iat:now,exp:now+900,aud:'appstoreconnect-v1'}:{iss:credential.clientEmail,scope:'https://www.googleapis.com/auth/androidpublisher',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}
 const input=[header,payload].map(value=>base64url(new TextEncoder().encode(JSON.stringify(value)))).join('.'),signature=await crypto.subtle.sign(apple?{name:'ECDSA',hash:'SHA-256'}:{name:'RSASSA-PKCS1-v1_5'},signingKey,new TextEncoder().encode(input))
 return input+'.'+base64url(new Uint8Array(signature))
}
/** Auth renewal is installation work. Its lease and compare-and-swap prevent
 * concurrent rotation from replacing a newer token. Disconnect wins every write. */
export async function token(runtime:PennyRuntime,c:Connection){
 const raw=runtime.database.binding,guard={sql:`EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle') AND EXISTS(SELECT 1 FROM penny_review_connections c JOIN oa_operators o ON o.id=c.owner_id WHERE c.id=? AND c.revision=? AND c.state=? AND (? IS NULL OR c.claim=?) AND o.status='active' AND o.role='owner' AND o.version=c.owner_version)`,params:[c.id,c.revision,c.state,c.claim,c.claim] as (string|number|null)[]},db=guardedDatabase(raw,guard)
 const row=await db.prepare('SELECT encrypted_token,refresh_claim FROM penny_review_credentials WHERE connection_id=?').bind(c.id).first<{encrypted_token:string;refresh_claim:string|null}>()
 if(!row)throw new NativeError('reviews_credentials_missing',503)
 let saved:{credential:Credential;accessToken?:string;expiresAt?:number}
 try{const value=JSON.parse(await open(runtime,c.id,row.encrypted_token));saved={...value,credential:credentialInput.parse(value.credential)}}catch(error){if(error instanceof NativeError)throw error;throw new NativeError('reviews_credentials_unreadable',503)}
 if(saved.credential.kind==='access_token')return saved.credential.value
 if(saved.credential.kind==='appstore')return jwt(saved.credential)
 if(saved.accessToken&&typeof saved.expiresAt==='number'&&saved.expiresAt>Date.now()+60000)return saved.accessToken
 if(row.refresh_claim)throw new NativeError('reviews_credential_refresh_reconciliation_required',409)
 const claim=crypto.randomUUID(),claimed=await db.prepare('UPDATE penny_review_credentials SET refresh_claim=? WHERE connection_id=? AND encrypted_token=? AND refresh_claim IS NULL RETURNING connection_id').bind(claim,c.id,row.encrypted_token).all()
 if(!claimed.results.length)throw new NativeError('reviews_credential_refresh_busy',409)
 try{
  const google=saved.credential.kind==='googleplay',body=google?new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:await jwt(saved.credential as Extract<Credential,{kind:'googleplay'}>)}):new URLSearchParams({grant_type:'refresh_token',refresh_token:(saved.credential as Extract<Credential,{kind:'trustpilot'}>).refreshToken})
  const trust=saved.credential as Extract<Credential,{kind:'trustpilot'}>,authorization=google?undefined:'Basic '+btoa(trust.clientId+':'+trust.clientSecret)
  const response=await wire(runtime,google?'https://oauth2.googleapis.com/token':'https://api.trustpilot.com/v1/oauth/oauth-business-users-for-applications/accesstoken',undefined,body.toString(),{'Content-Type':'application/x-www-form-urlencoded',...(authorization?{Authorization:authorization}:{})})
  if(response.status!==200)throw new NativeError('reviews_credential_renewal_failed',503)
  let result:{access_token:string;expires_in:number;refresh_token?:string};try{const value=JSON.parse(response.body);if(typeof value.access_token!=='string'||!value.access_token||value.access_token.length>8192||!Number.isFinite(value.expires_in)||value.expires_in<60||value.expires_in>2592000||value.refresh_token!==undefined&&(typeof value.refresh_token!=='string'||!value.refresh_token||value.refresh_token.length>4096))throw Error();result=value}catch{throw new NativeError('reviews_credential_renewal_invalid',503)}
  if(!google&&result.refresh_token)saved.credential={...trust,refreshToken:result.refresh_token}
  const encrypted=await seal(runtime,c.id,JSON.stringify({...saved,accessToken:result.access_token,expiresAt:Date.now()+result.expires_in*1000}))
  const changed=await db.prepare('UPDATE penny_review_credentials SET encrypted_token=?,refresh_claim=NULL WHERE connection_id=? AND refresh_claim=? RETURNING connection_id').bind(encrypted,c.id,claim).all()
  if(!changed.results.length)throw new NativeError('reviews_credential_authority_changed',409)
  return result.access_token
 }catch(error){
  // A refresh may have rotated at the vendor even if its response was lost.
  // Keep the claim until a fresh credential is explicitly supplied; never replay it.
  throw error instanceof NativeError?error:new NativeError('reviews_credential_renewal_uncertain',503)
 }
}
