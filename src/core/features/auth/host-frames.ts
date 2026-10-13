import type {PennyRuntime} from '@/core/app/runtime'
import {validateFrameOrigins} from '@/core/platform/configuration'
import {NativeError} from './native-tokens'

export async function hostFrameOrigins(runtime:PennyRuntime):Promise<string[]>{
 const row=await runtime.database.binding.prepare('SELECT public_origin_allowlist FROM penny_frame_settings WHERE singleton=1').first<{public_origin_allowlist:string}>()
 try{return validateFrameOrigins(row ? JSON.parse(row.public_origin_allowlist) : [...runtime.configuration.publicOriginAllowlist],runtime.configuration.environment)}
 catch{throw new NativeError('host_frame_configuration_invalid',503)}
}
