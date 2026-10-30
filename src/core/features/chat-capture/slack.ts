import type {PennyRuntime} from '@/core/app/runtime'
import {integrationTransport} from '../integrations/transport'
import type {ChatConnection} from './configuration'

export class SlackFailure extends Error {
 readonly code:string
 readonly delay:number
 readonly removed:boolean
 constructor(code:string,delay=60_000,removed=false){super(code);this.code=code;this.delay=delay;this.removed=removed}
}
export async function slack(runtime:PennyRuntime,connection:Pick<ChatConnection,'bot_token'>,method:string,values:Record<string,string>){
 const response=await integrationTransport(runtime).send({url:'https://slack.com/api/'+method,headers:{authorization:'Bearer '+connection.bot_token,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values).toString()})
 if(response.status===429){const seconds=Number(response.headers['retry-after']??response.headers['Retry-After']);throw new SlackFailure('slack_rate_limited',Number.isFinite(seconds)?Math.max(60_000,Math.min(86400,seconds)*1000):60_000)}
 if(response.status!==200)throw new SlackFailure('slack_unavailable')
 let data;try{data=JSON.parse(response.body)}catch{throw new SlackFailure('slack_response_invalid')}
 if(!data||data.ok!==true){
  const removed=['message_not_found','channel_not_found','not_in_channel','invalid_auth','token_revoked','account_inactive'].includes(data?.error)
  throw new SlackFailure(removed?'slack_source_unavailable':data?.error==='missing_scope'?'slack_scope_required':'slack_request_failed',60_000,removed)
 }
 return data
}
const ts=/^\d{1,12}\.\d{6}$/
export function messageTimestamp(value:unknown):value is string{return typeof value==='string'&&ts.test(value)}
export function permalink(value:unknown){
 if(typeof value!=='string')throw new SlackFailure('slack_permalink_invalid')
 let url:URL;try{url=new URL(value)}catch{throw new SlackFailure('slack_permalink_invalid')}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.endsWith('.slack.com')||!/^\/[a-zA-Z0-9/_-]+$/.test(url.pathname)||url.hash||[...url.searchParams.keys()].some(key=>!['thread_ts','cid'].includes(key)))throw new SlackFailure('slack_permalink_invalid')
 return url.href
}
