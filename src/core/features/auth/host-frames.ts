import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from './native-tokens'
export function hostFrameOrigins(runtime:PennyRuntime):string[]{
 if(!runtime.bindings.PORTAL_FRAME_ORIGINS)return []
 try{
  const values:unknown=JSON.parse(runtime.bindings.PORTAL_FRAME_ORIGINS)
  if(!Array.isArray(values)||values.length>10||values.some(value=>{
   if(typeof value!=='string')return true
   const url=new URL(value),local=['local','test'].includes(runtime.configuration.environment)&&['127.0.0.1','localhost'].includes(url.hostname)
   return url.origin!==value||url.username||url.password||url.hash||url.search||!(url.protocol==='https:'||(local&&url.protocol==='http:'))
  }))throw new Error('invalid')
  return [...new Set(values as string[])]
 }catch{throw new NativeError('host_frame_configuration_invalid',503)}
}
