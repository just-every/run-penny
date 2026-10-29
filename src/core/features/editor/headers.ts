import {releaseVideoOrigins} from '../releases/rich-content'
import {hostFrameOrigins} from '../auth/host-frames'
import {editorConfiguration} from './config'
import type {PennyRuntime} from '@/core/app/runtime'
export async function editorDocumentHeaders(response:Response,runtime:PennyRuntime,pathname:string):Promise<Response> {
 const config=editorConfiguration(runtime)
 const headers=new Headers(response.headers),directives=(headers.get('Content-Security-Policy')??'').split(';').map(value=>value.trim()).filter(Boolean)
 const index=directives.findIndex(value=>/^frame-src(?:\s|$)/.test(value))
 if(config&&index<0)directives.push("frame-src 'self' "+config.managementOrigin)
 else if(config&&!directives[index].split(/\s+/).includes(config.managementOrigin))directives[index]+=' '+config.managementOrigin
 if(pathname==='/portal/updates'||pathname.startsWith('/portal/updates/')){
  const frame=directives.findIndex(value=>/^frame-src(?:\s|$)/.test(value))
  if(frame<0)directives.push("frame-src 'self' "+releaseVideoOrigins.join(' '))
  else directives[frame]+=' '+releaseVideoOrigins.join(' ')
 }
 const ancestors=["'self'",...((pathname==='/'||pathname==='/portal'||pathname.startsWith('/portal/'))?await hostFrameOrigins(runtime):[])].join(' ')
 const helpScoutPanel=pathname==='/api/integrations/helpscout/panel'
 const frameIndex=directives.findIndex(value=>/^frame-ancestors(?:\s|$)/.test(value))
 if(frameIndex<0)directives.push('frame-ancestors '+(helpScoutPanel?"'self' https://secure.helpscout.net https://*.helpscout.com":ancestors));else directives[frameIndex]='frame-ancestors '+(helpScoutPanel?"'self' https://secure.helpscout.net https://*.helpscout.com":ancestors)
 headers.delete('X-Frame-Options')
 headers.set('Content-Security-Policy',directives.join('; '))
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers})
}
