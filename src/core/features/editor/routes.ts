import type {Hono} from 'hono'
import type {PennyRuntime} from '@/core/app/runtime'
import type {AppBindings} from '@/core/shared/bindings'
import {editorConfiguration} from './config'
import {requireEditorOwner} from './owner'
import {NativeError} from '../auth/native-tokens'
export function registerEditorRoutes(app:Hono<{Bindings:AppBindings;Variables:{runtime:PennyRuntime}}>):void {
 app.all('/api/editor/config',async c=>{
  c.header('Cache-Control','private, no-store');c.header('Vary','Cookie')
  const runtime=c.get('runtime');await requireEditorOwner(runtime,c.req.raw)
  if(c.req.method!=='GET')return c.json({error:'method_not_allowed'},405)
  const config=editorConfiguration(runtime)
  if(!config)throw new NativeError('editor_unconfigured',503)
  return c.json({config,expiresAt:Date.now()+30_000})
 })
}
