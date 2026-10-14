import manifest from '../../../seed.json'
import {isDeclaredSessionlessPath,isPublicAssetPath} from './public-paths'
import type {AppBindings} from '@/core/shared/bindings'
import {digest} from '@/core/features/auth/native-tokens'

// One shared bucket prevents path, query and method aliases from multiplying the
// allowance. Existing identity, mail and mutation limits remain independent.
export const publicRatePolicy={scope:'public_entry',allowance:manifest.limits.publicReadRequestsPerMinutePerIp,windowMs:60_000,maxClients:10_000} as const
export const publicWriteRatePolicy={...publicRatePolicy,scope:'public_entry_write',allowance:manifest.limits.publicWriteRequestsPerMinutePerIp} as const
// A browser revalidates every asset of a document on each load; charging those
// to page reads would refuse a few fresh tabs. Assets keep their own bound.
export const publicAssetRatePolicy={...publicRatePolicy,scope:'public_entry_asset',allowance:manifest.limits.publicAssetRequestsPerMinutePerIp} as const
// Every public document fetches its branding and frame policy once; charging
// them to page reads would make 120 reads 40 page views. They keep their own bound.
export const publicChromePaths=new Set(['/api/public/branding','/api/public/identity/host/frames'])
export const publicChromeRatePolicy={...publicRatePolicy,scope:'public_entry_chrome',allowance:manifest.limits.publicChromeRequestsPerMinutePerIp} as const
const mailEventRatePolicy={...publicRatePolicy,scope:'public_entry_mail',allowance:manifest.limits.mailEventsPerMinutePerIp} as const
const admitted=new WeakSet<Request>()

function clientAddress(request:Request):string {
 // Cloudflare overwrites this header at the ingress. Never trust X-Forwarded-For.
 const value=request.headers.get('CF-Connecting-IP')??''
 if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)&&value.split('.').every(part=>Number(part)<=255))return value.split('.').map(Number).join('.')
 if(value.includes(':')&&!/[\s%\[\]]/.test(value)){
  try{return new URL('http://['+value+']/').hostname}catch{/* Missing/invalid ingress identity shares a fail-closed bucket. */}
 }
 return 'unattributed'
}

/** Entry admission precedes all asset lookup, document rendering and handlers,
 * including generated POST functions. A Request-local receipt prevents charging
 * again when the Worker delegates to Hono; no caller-controlled bypass header. */
export async function admitPublicRequest(request:Request,bindings:AppBindings):Promise<Response|null>{
 if(admitted.has(request))return null
 const path=new URL(request.url).pathname
 if(!isDeclaredSessionlessPath(path)&&!isPublicAssetPath(path)&&!path.startsWith('/api/public/')&&!path.startsWith('/auth/')&&!path.startsWith('/.well-known/'))return null
 const read=['GET','HEAD','OPTIONS'].includes(request.method)||path.startsWith('/_serverFn/')
 const policy=read?isPublicAssetPath(path)?publicAssetRatePolicy:publicChromePaths.has(path)?publicChromeRatePolicy:publicRatePolicy:path==='/api/public/mail/events'?mailEventRatePolicy:publicWriteRatePolicy
 const {scope,allowance,windowMs,maxClients}=policy,now=new Date().toISOString()
 try{
  const db=bindings.DB,subject=await digest(clientAddress(request))
  const results=await db.batch([
   db.prepare('DELETE FROM penny_public_admission WHERE scope=? AND subject_hash IN (SELECT subject_hash FROM penny_public_admission WHERE scope=? AND expires_at<=? LIMIT 128)').bind(scope,scope,now),
   db.prepare(`INSERT INTO penny_public_admission(scope,subject_hash,count,expires_at)
     SELECT ?,?,1,? WHERE EXISTS(SELECT 1 FROM penny_public_admission WHERE scope=? AND subject_hash=?)
       OR (SELECT count(*) FROM (SELECT 1 FROM penny_public_admission WHERE scope=? LIMIT ?))<?
     ON CONFLICT(scope,subject_hash) DO UPDATE SET
       count=CASE WHEN expires_at<=? THEN 1 ELSE min(count+1,?) END,
       expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END
     RETURNING count,expires_at`).bind(scope,subject,new Date(Date.now()+windowMs).toISOString(),scope,subject,scope,maxClients,maxClients,now,allowance+1,now),
  ])
  const row=results[1]?.results[0] as {count:number;expires_at:string}|undefined
  if(!row||row.count>allowance)return Response.json({error:'rate_limited'},{status:429,headers:{'Cache-Control':'no-store','Retry-After':String(row?Math.max(1,Math.ceil((Date.parse(row.expires_at)-Date.now())/1000)):Math.ceil(windowMs/1000))}})
  admitted.add(request)
  return null
 }catch{
  return Response.json({error:'public_admission_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})
 }
}
