import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {base64urlDecode,equalBytes,sign} from './tokens'
import {digest,NativeError} from './native-tokens'
const schema=z.object({
 aud:z.string().url(),issuedAt:z.string().datetime({offset:true}),
 displayName:z.string().trim().min(1).max(160),email:z.string().trim().toLowerCase().email().max(254),
 accountId:z.string().trim().min(1).max(256).optional(),accountName:z.string().trim().min(1).max(256).optional(),
 revenueCents:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
 renewalDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value).optional(),
 health:z.string().trim().min(1).max(160).optional(),
}).strict().refine(claim=>Boolean(claim.accountId)===Boolean(claim.accountName)&&(!(claim.revenueCents!==undefined||claim.renewalDate!==undefined||claim.health!==undefined)||Boolean(claim.accountId)))
export async function verifyHostClaims(runtime:PennyRuntime,encoded:string,signatureText:string){
 const fail=()=>new NativeError('requester_identity_required',401)
 if(encoded.length>4096||signatureText.length>128)throw fail()
 const secret=runtime.configuration.portalIdentitySecret
 if(!secret)throw new NativeError('auth_unavailable',503)
 const bytes=base64urlDecode(encoded),signature=base64urlDecode(signatureText)
 if(!bytes||!signature||!equalBytes(await sign(secret,encoded),signature))throw fail()
 let value:unknown
 try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw fail()}
 const result=schema.safeParse(value)
 if(!result.success||result.data.aud!==runtime.configuration.appOrigin)throw fail()
 const issued=Date.parse(result.data.issuedAt),now=Date.now()
 if(issued<now-24*60*60*1000||issued>now+5*60*1000)throw fail()
 return {...result.data,issuedAt:new Date(issued).toISOString(),claimHash:await digest(encoded)}
}
