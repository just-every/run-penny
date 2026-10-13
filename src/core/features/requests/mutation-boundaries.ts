import type { PennyRuntime } from '@/core/app/runtime'
import { clientIp } from '@/core/features/auth/native-routes'
import { NativeError, takeRateLimit } from '@/core/features/auth/native-tokens'

export async function limitPublicWrite(runtime:PennyRuntime,request:Request,requesterId?:string) {
  if(['GET','HEAD','OPTIONS'].includes(request.method))return
  await takeRateLimit(runtime.database.binding,requesterId?'public_write_identity':'public_write_ip',requesterId??clientIp(request),requesterId?20:30,60000)
}

export async function readAttachment(request:Request):Promise<File> {
  const maximum=25*1024*1024
  const length=request.headers.get('Content-Length')
  if(length && Number(length)>maximum)throw new NativeError('request_too_large',413)
  if(!request.headers.get('Content-Type')?.startsWith('multipart/form-data;'))throw new NativeError('attachment_invalid',400)
  const reader=request.body?.getReader()
  if(!reader)throw new NativeError('attachment_invalid',400)
  const chunks:Uint8Array<ArrayBuffer>[]=[]
  let size=0
  try {
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength
      if(size>maximum){await reader.cancel();throw new NativeError('request_too_large',413)}
      chunks.push(part.value)
    }
  }finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  const form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('Content-Type')!}}).formData().catch(()=>null)
  const entries=form?[...form.entries()]:[]
  if(entries.length!==1 || entries[0][0]!=='file' || !(entries[0][1] instanceof File))throw new NativeError('attachment_invalid',400)
  return entries[0][1]
}
