import {Buffer} from 'node:buffer'
import {deflateRawSync,inflateRawSync} from 'node:zlib'
import {NativeError} from '../auth/native-tokens'
import {sign} from '../auth/tokens'

// The native scope already permits 24 MiB of records. Allow metadata above it,
// compress before encryption, and never retain decoded import pages in a token.
export const PREVIEW_SCOPE_BYTES=32*1024*1024
export const PREVIEW_TOKEN_BYTES=24*1024*1024
const compressedLimit=Math.floor((PREVIEW_TOKEN_BYTES-3)*3/4)-28
export type PreviewTokenContext={secret:string;subject:string;table:string;id:string}
const changed=()=>new NativeError('erasure_plan_changed',409)
const aad=(context:PreviewTokenContext)=>Buffer.from(JSON.stringify(['penny-erasure-preview-v1',context.subject,context.table,context.id]))
const key=async(context:PreviewTokenContext)=>crypto.subtle.importKey('raw',new Uint8Array(await sign(context.secret,'penny-erasure-preview-encryption-v1')),{name:'AES-GCM'},false,['encrypt','decrypt'])
function compress(value:unknown):Buffer{
 const plain=Buffer.from(JSON.stringify(value))
 if(plain.length>PREVIEW_SCOPE_BYTES)throw new NativeError('Erasure preview exceeds the bounded 32 MiB scope; no records were removed.',413)
 const compressed=deflateRawSync(plain,{level:1})
 if(compressed.length>compressedLimit)throw new NativeError('Erasure preview continuation exceeds 24 MiB; no records were removed.',413)
 return compressed
}
export async function sealPreview(value:unknown,context:PreviewTokenContext):Promise<string>{
 const compressed=compress(value),iv=crypto.getRandomValues(new Uint8Array(12))
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(context)},await key(context),new Uint8Array(compressed))
 return 'p1.'+Buffer.concat([iv,Buffer.from(encrypted)]).toString('base64url')
}
function expand(plain:ArrayBuffer):unknown{
 const input=Buffer.from(plain),result=inflateRawSync(input,{info:true,maxOutputLength:PREVIEW_SCOPE_BYTES}) as unknown as {buffer:Buffer;engine:{bytesWritten:number}}
 if(result.engine.bytesWritten!==input.length)throw changed()
 return JSON.parse(result.buffer.toString('utf8'))
}
export async function openPreview<T>(token:string,context:PreviewTokenContext):Promise<T>{
 if(token.length>PREVIEW_TOKEN_BYTES||!/^p1\.[A-Za-z0-9_-]+$/.test(token))throw changed()
 try{
  const bytes=Buffer.from(token.slice(3),'base64url')
  if(bytes.length<29||bytes.length>compressedLimit+28||bytes.toString('base64url')!==token.slice(3))throw changed()
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(0,12),additionalData:aad(context)},await key(context),bytes.subarray(12))
  return expand(plain) as T
 }catch{throw changed()}
}
