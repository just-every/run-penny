import {createServerFn} from '@tanstack/react-start'
export const loadEditorAdmission=createServerFn({method:'GET'}).handler(async()=>{
 const [{getRequest},{requestContext},{createPennyRuntime},{editorConfiguration},{editorOwner}]=await Promise.all([import('@tanstack/react-start/server'),import('@/core/app/request-context.server'),import('@/core/app/runtime'),import('./config'),import('./owner')])
 const {bindings,configuration}=requestContext(),runtime=createPennyRuntime(bindings,configuration)
 if(!bindings.RER_MANAGEMENT_ORIGIN||!bindings.RER_INSTALLATION_ID)return false
 return Boolean(await editorOwner(runtime,getRequest())&&editorConfiguration(runtime))
})
