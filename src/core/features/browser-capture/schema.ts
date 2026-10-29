import {z} from 'zod'
export const pageUrl=z.string().max(4096).refine(value=>{
 try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password}catch{return false}
})
const id=z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/u)
export const captureInput=z.object({
 id:z.uuid(),pageUrl,wording:z.string().trim().max(20000),observedAt:z.iso.datetime({offset:true}),
 namedSpeaker:z.string().trim().max(200).optional(),requestId:id.optional(),requesterId:id.optional(),
 proxyVote:z.boolean(),purgeDays:z.number().int().min(0).max(365),
 screenshot:z.object({hash:z.string().regex(/^[a-f0-9]{64}$/),bytes:z.number().int().positive().max(10485760)}).strict().optional(),
}).strict().refine(value=>Boolean(value.wording||value.screenshot),'Select text or include a screenshot.')
 .refine(value=>!value.proxyVote||Boolean(value.requestId&&value.requesterId&&value.wording),'A proxy vote needs a customer, request and source excerpt.')
export type CaptureInput=z.infer<typeof captureInput>
export interface Capture {
 requester_name?:string;request_title?:string;owner_name?:string;
 id:string;evidence_id:string;page_url:string;source_hash:string;payload_hash:string;source_state:string;
 purge_days:number;purge_at:string|null;state:string;failure:string|null;started_at:string|null;claim:string|null;
 screenshot_hash:string|null;screenshot_bytes:number|null;request_id:string|null;requester_id:string|null;
 proxy_vote:number;actor_id:string|null;created_at:string;updated_at:string
}
export async function digest(value:string|ArrayBuffer){
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))].map(byte=>byte.toString(16).padStart(2,'0')).join('')
}
export const sourceFingerprint=(wording:string,screenshotHash?:string)=>digest(wording.trim()||screenshotHash||'')
