import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
import {teamsConfiguration,teamsWire} from './configuration'
const issuer='https://api.botframework.com'
const metadataUrl='https://login.botframework.com/v1/.well-known/openidconfiguration'
const keysUrl='https://login.botframework.com/v1/.well-known/keys'
const header=z.object({alg:z.literal('RS256'),kid:z.string().min(1).max(200)})
const claims=z.object({iss:z.literal(issuer),aud:z.string(),exp:z.number().int(),nbf:z.number().int(),serviceurl:z.string().url()})
const jwk=z.object({kty:z.literal('RSA'),kid:z.string(),n:z.string(),e:z.string(),use:z.literal('sig').optional(),endorsements:z.array(z.string()).optional()})
function bytes(value:string){if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error();return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))}
const json=(value:string)=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes(value)))
/** Public-cloud Bot Framework channel-to-bot JWT validation. Provider-controlled
 * jku/x5u URLs, emulator tokens, algorithms and user-supplied key sets are ignored. */
export async function verifyTeamsToken(runtime:PennyRuntime,request:Request):Promise<string>{
 const authorization=request.headers.get('Authorization')??''
 if(!/^Bearer [A-Za-z0-9_.-]{1,16384}$/i.test(authorization))throw new NativeError('teams_token_invalid',401)
 let head:z.infer<typeof header>,body:z.infer<typeof claims>,parts:string[]
 try{
  parts=authorization.slice(7).split('.');if(parts.length!==3)throw Error()
  head=header.parse(json(parts[0]));body=claims.parse(json(parts[1]))
  const config=teamsConfiguration(runtime),now=Date.now()/1000
  if(!config||body.aud!==config.applicationId||body.exp<=now||body.nbf>now+60||body.exp<=body.nbf)throw Error()
 }catch{throw new NativeError('teams_token_invalid',401)}
 const metadata=await teamsWire(runtime,metadataUrl)
 if(metadata.status!==200)throw new NativeError('teams_keys_unavailable',503)
 try{const value=JSON.parse(metadata.body);if(value.issuer!==issuer||value.jwks_uri!==keysUrl)throw Error()}catch{throw new NativeError('teams_keys_invalid',503)}
 const response=await teamsWire(runtime,keysUrl)
 if(response.status!==200)throw new NativeError('teams_keys_unavailable',503)
 try{
  const keys=z.object({keys:z.array(jwk).max(100)}).parse(JSON.parse(response.body)).keys
  const key=keys.find(key=>key.kid===head.kid&&(!key.endorsements?.length||key.endorsements.includes('msteams')))
  if(!key)throw Error()
  const imported=await crypto.subtle.importKey('jwk',{kty:key.kty,n:key.n,e:key.e},{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify'])
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',imported,bytes(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw Error()
  return body.serviceurl
 }catch{throw new NativeError('teams_token_invalid',401)}
}
