import {z} from 'zod'
import {convert} from 'html-to-text'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError,digest} from '../auth/native-tokens'
import {teamsConfiguration,teamsWire,teamId,sourceId,messageId} from './configuration'
export function validTeamsLink(value:string){
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='teams.microsoft.com'&&!url.username&&!url.password&&!url.port&&url.pathname.startsWith('/l/message/')}catch{return false}
}
export const sourceMessage=z.object({
 id:messageId,webUrl:z.string().max(4096).refine(validTeamsLink),
 createdDateTime:z.iso.datetime({offset:true}),lastModifiedDateTime:z.iso.datetime({offset:true}).optional(),
 deletedDateTime:z.iso.datetime({offset:true}).nullable().optional(),
 body:z.object({contentType:z.enum(['text','html']),content:z.string().max(20000)}),
 from:z.object({user:z.object({id:z.string().max(200),displayName:z.string().max(200).nullable().optional()}).nullable().optional()}).nullable().optional(),
})
export function isDeletedMessage(body:string,id:string){
 try{const parsed=z.object({id:messageId,deletedDateTime:z.iso.datetime({offset:true})}).safeParse(JSON.parse(body));return parsed.success&&parsed.data.id===id}catch{return false}
}
export const sourceHash=(message:z.infer<typeof sourceMessage>)=>digest(JSON.stringify({body:message.body,from:message.from??null,modified:message.lastModifiedDateTime??null}))
export async function readMessage(message:z.infer<typeof sourceMessage>){
 if(message.body.contentType==='text')return message.body.content
 // Parse only the selected message's HTML as inert text; never load links/images.
 return convert(message.body.content,{wordwrap:false,selectors:[{selector:'a',options:{ignoreHref:true}},{selector:'img',format:'skip'},...['h1','h2','h3','h4','h5','h6'].map(selector=>({selector,options:{uppercase:false}}))]})
}
export async function teamsMessage(runtime:PennyRuntime,team:string,channel:string,message:string,parent:string|null,authorize:()=>Promise<unknown>){
 const config=teamsConfiguration(runtime)
 if(!config)throw new NativeError('teams_unconfigured',503)
 if(!teamId.safeParse(team).success||!sourceId.safeParse(channel).success||!messageId.safeParse(message).success||parent!==null&&!messageId.safeParse(parent).success)throw new NativeError('teams_message_invalid',400)
 const token=await teamsWire(runtime,`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,'POST',{'Content-Type':'application/x-www-form-urlencoded'},new URLSearchParams({client_id:config.applicationId,client_secret:config.clientSecret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'}).toString())
 if(token.status!==200)throw new NativeError(token.status===429?'teams_rate_limited':'teams_credentials_rejected',503)
 let access:string
 try{access=z.object({access_token:z.string().min(1).max(16384).regex(/^[^\r\n\0]+$/),token_type:z.string().refine(s=>s.toLowerCase()==='bearer')}).parse(JSON.parse(token.body)).access_token}catch{throw new NativeError('teams_token_response_invalid',503)}
 await authorize()
 return teamsWire(runtime,`https://graph.microsoft.com/v1.0/teams/${team}/channels/${encodeURIComponent(channel)}/messages/${parent?parent+'/replies/'+message:message}`,'GET',{Authorization:'Bearer '+access})
}
