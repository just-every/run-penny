export interface Draft {id:string;mode:'capture'|'check';pageUrl:string;wording:string;observedAt:string;status:number;image?:string}
export interface Job {created_at?:string;wording?:string;observed_at?:string;named_speaker?:string|null;requester_name?:string;request_title?:string;screenshot_hash?:string|null;id:string;evidence_id:string;page_url:string;state:string;failure:string|null;source_state:string;owner_name?:string;request_id?:string|null;requester_id?:string|null;proxy_vote?:number;purge_days?:number}
export async function api<T>(path:string,body?:unknown):Promise<T>{
 const response=await fetch(path,body===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),result=await response.json() as T&{message?:string;error?:string}
 if(!response.ok)throw Error(response.status===401?'Your operator session expired. Sign in to Penny, then resume the review.':result.message??result.error?.replaceAll('_',' ')??'Penny could not confirm this action. Keep the review and retry.')
 return result
}
export async function screenshotFile(image?:string){
 if(!image)return undefined
 if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image)||image.length>12582912)throw Error('The screenshot must be a PNG within the attachment limit.')
 const bytes=Uint8Array.from(atob(image.split(',')[1]),character=>character.charCodeAt(0))
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('')
 return {file:new File([bytes],'browser-screenshot.png',{type:'image/png'}),hash,bytes:bytes.byteLength}
}
export async function upload(id:string,file:File){
 const body=new FormData();body.set('file',file)
 const response=await fetch(`/api/operator/browser-captures/${id}/screenshot`,{method:'POST',body}),result=await response.json() as {message?:string}
 if(!response.ok)throw Error(response.status===401?'Your operator session expired. Sign in, then resume.':result.message??'Screenshot upload could not be confirmed. Keep the original review and retry.')
}
export function isDraft(value:unknown):value is Draft{
 if(!value||typeof value!=='object')return false
 const d=value as Draft
 return typeof d.id==='string'&&/^[a-f0-9-]{36}$/.test(d.id)&&['capture','check'].includes(d.mode)&&typeof d.pageUrl==='string'&&/^https?:\/\//.test(d.pageUrl)&&d.pageUrl.length<=4096&&typeof d.wording==='string'&&d.wording.length<=20000&&typeof d.observedAt==='string'&&Number.isFinite(Date.parse(d.observedAt))&&typeof d.status==='number'&&(!d.image||typeof d.image==='string'&&d.image.startsWith('data:image/png;base64,')&&d.image.length<=12582912)
}
