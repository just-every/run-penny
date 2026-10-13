import {parseConfig,type EditorConfig} from '../../../../base/modules/editor/src/config'
import {NativeError} from '../auth/native-tokens'
import type {PennyRuntime} from '@/core/app/runtime'
export function editorConfiguration(runtime:PennyRuntime):EditorConfig|null {
 const {RER_MANAGEMENT_ORIGIN:managementOrigin,RER_INSTALLATION_ID:installationId}=runtime.bindings
 if(!managementOrigin&&!installationId)return null
 try {
  const config=parseConfig({enabled:true,managementOrigin,installationId})
  if(new URL(config.managementOrigin).protocol!=='https:'&&!['local','test'].includes(runtime.configuration.environment))throw new Error('insecure_management_origin')
  return config
 }catch{throw new NativeError('editor_configuration_invalid',503)}
}
