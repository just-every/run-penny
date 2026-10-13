import {hostFrameOrigins} from '../auth/host-frames'
import {editorConfiguration} from './config'
import type {PennyRuntime} from '@/core/app/runtime'
export function editorDocumentHeaders(response:Response,runtime:PennyRuntime,pathname:string):Response {
 const config=editorConfiguration(runtime)
 const headers=new Headers(response.headers),directives=(headers.get('Content-Security-Policy')??'').split(';').map(value=>value.trim()).filter(Boolean)
 const index=directives.findIndex(value=>/^frame-src(?:\s|$)/.test(value))
 if(config&&index<0)directives.push("frame-src 'self' "+config.managementOrigin)
 else if(config&&!directives[index].split(/\s+/).includes(config.managementOrigin))directives[index]+=' '+config.managementOrigin
 const ancestors=["'self'",...(pathname.startsWith('/portal/')?hostFrameOrigins(runtime):[])].join(' ')
 const frameIndex=directives.findIndex(value=>/^frame-ancestors(?:\s|$)/.test(value))
 if(frameIndex<0)directives.push('frame-ancestors '+ancestors);else directives[frameIndex]='frame-ancestors '+ancestors
 headers.set('Content-Security-Policy',directives.join('; '))
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers})
}
