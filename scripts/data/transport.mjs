import {dataOrigin} from './options.mjs'
import {privateSession,MAX_ARCHIVE_BYTES} from './private-files.mjs'
import {refuse} from './errors.mjs'
const MAX_RESPONSE_BYTES=MAX_ARCHIVE_BYTES+1024*1024
export async function dataTransport(originValue,sessionFile,namespace='data') {
 if(!['data','feedback-import'].includes(namespace))refuse('invalid_data_namespace')
 const origin=dataOrigin(originValue),cookie=await privateSession(sessionFile)
 return async function request(path,body) {
  if(!/^[a-z0-9_/-]+$/i.test(path))refuse('invalid_data_path')
  const encoded=body===undefined?undefined:JSON.stringify(body)
  const requestLimit=namespace==='feedback-import'?34*1024*1024:MAX_ARCHIVE_BYTES
  if(encoded&&Buffer.byteLength(encoded)>requestLimit)refuse(namespace==='feedback-import'?`Feedback request exceeds the ${requestLimit}-byte limit. No history was applied.`:'data_request_limit')
  let response
  try {response=await fetch(new URL('/api/operator/'+namespace+'/'+path,origin),{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:origin.origin,...(body===undefined?{}:{'Content-Type':'application/json'})},...(encoded===undefined?{}:{body:encoded}),redirect:'error',signal:AbortSignal.timeout(180000)})}
  catch {refuse('data_transport_failed')}
  if(!response.ok) {
   if(namespace==='feedback-import'&&response.headers.get('content-type')?.includes('application/json')){
    const reader=response.body?.getReader();let size=0;const chunks=[]
    try{if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384)break;chunks.push(value)}
     if(size<=16384){let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{};const message=typeof value?.message==='string'?value.message:typeof value?.reason==='string'&&/^[A-Z][A-Z0-9_]+$/.test(value.reason)?value.reason:typeof value?.error==='string'?value.error:''
      if(message&&(/^[a-zA-Z][a-zA-Z0-9_]+$/.test(message)||/^(Ideas |Missing Ideas |Unknown Ideas |Each Ideas |Invalid aggregate |Saved |Normalized import |Original files |Erasure |Finish or reconcile)/.test(message)))refuse(message.replace(/[\x00-\x1f\x7f]/g,' ').slice(0,2000))
     }
    }finally{await reader?.cancel().catch(()=>{});reader?.releaseLock()}
   }else await response.body?.cancel()
   refuse('data_request_failed_'+response.status)
  }
  if(response.status===204)return null
  if(!response.headers.get('content-type')?.includes('application/json')) {await response.body?.cancel();refuse('invalid_data_response')}
  const reader=response.body?.getReader();if(!reader)refuse('invalid_data_response')
  const chunks=[];let size=0
  try {
   while(true) {const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_RESPONSE_BYTES)refuse('data_response_limit');chunks.push(value)}
   try {return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch {refuse('invalid_data_response')}
  } finally {await reader.cancel().catch(()=>{});reader.releaseLock()}
 }
}
