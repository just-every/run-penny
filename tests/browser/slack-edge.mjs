// Recorded Slack Web API responses at the enforcing network edge. All Penny
// admission, storage, retries, Cron and browser rendering use production bytes.
export function slackEdge(){
 return {name:'slack-edge',modules:true,compatibilityDate:'2026-08-31',script:`
 import {WorkerEntrypoint} from 'cloudflare:workers';
 let mode='normal',calls=[];
 const root='1793188800.000001';
 export default class Edge extends WorkerEntrypoint {
  async fetch(request){const url=new URL(request.url);if(url.pathname==='/control'){mode=await request.text();return new Response('ok')}return Response.json(calls)}
  async send(wire){
   const url=new URL(wire.url),args=new URLSearchParams(wire.body),method=url.pathname.split('/').pop();
   if(url.origin!=='https://slack.com'||wire.headers.authorization!=='Bearer synthetic-slack-bot-token')throw Error('unexpected destination');
   const channel=args.get('channel'),stamp=args.get('timestamp');calls.push({method,channel,stamp});
   if(method==='auth.test')return {status:200,headers:{},body:JSON.stringify({ok:true,team_id:'THOME'})};
   if(method==='users.info'&&args.get('user')==='UCUSTOMER')return {status:200,headers:{},body:JSON.stringify({ok:true,user:{id:'UCUSTOMER',real_name:'Customer speaker',profile:{email:'must-not-copy@example.test'}}})};
   if(!['CSHARED','CINTERNAL'].includes(channel))throw Error('out-of-scope source read');
   const result=value=>({status:200,headers:{},body:JSON.stringify(value)});
   if(mode==='hold')await new Promise(resolve=>setTimeout(resolve,60000));
   if(mode==='rate')return {status:429,headers:{'retry-after':'60'},body:'rate limited'};
   if(mode==='transport')throw Error('synthetic network interruption');
   if(mode==='revoked')return result({ok:false,error:'invalid_auth'});
   if(mode==='gone')return result({ok:false,error:'message_not_found'});
   if(method==='reactions.get')return result({ok:true,type:'message',channel,message:{type:'message',ts:stamp,thread_ts:root,user:'UCUSTOMER',team:channel==='CSHARED'?'TEXTERNAL':'THOME',text:mode==='edited'?'Changed customer wording':stamp.endsWith('000004')?'Restarted capture after failure':stamp.endsWith('000003')?'Internal channel excerpt':'Please add scheduled exports; contact customer@example.test',files:[{private:'must not persist'}]}});
   if(method==='conversations.info')return result({ok:true,channel:{id:channel,is_ext_shared:channel==='CSHARED',shared_team_ids:['THOME','TEXTERNAL']}});
   if(method==='chat.getPermalink')return result({ok:true,permalink:'https://harbor.slack.com/archives/'+channel+'/p'+args.get('message_ts').replace('.','')});
   throw Error('unexpected Slack method');
  }
 }`}
}
