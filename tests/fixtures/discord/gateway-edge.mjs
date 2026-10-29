// Network edge for the real relay/register CLI journey; no product mocks.
import assert from 'node:assert/strict'
import {readFile,appendFile} from 'node:fs/promises'
import {createHmac} from 'node:crypto'
const config=JSON.parse(await readFile(process.argv[2],'utf8')),report=process.env.PENNY_DISCORD_EDGE_REPORT
const record=value=>appendFile(report,JSON.stringify(value)+'\n')
const reset=process.env.PENNY_DISCORD_EDGE_RESET
let connection=0,latestSocket
const guild=config.guildId,channel=config.channelIds[0],member='120000000000000005',message='130000000000000001'
const reaction=chosen=>({op:0,t:'MESSAGE_REACTION_ADD',s:chosen===channel?2:3,d:{guild_id:guild,channel_id:chosen,message_id:message,user_id:member,member:{user:{id:member,username:'Trigger member'}},emoji:{id:null,name:'📌'}}})
globalThis.fetch=async(input,init={})=>{
 if(input==='https://discord.com/api/v10/gateway/bot'){assert.equal(init.headers.Authorization,`Bot ${config.botToken}`);return Response.json({url:'wss://gateway.discord.gg/'})}
 if(input===`https://discord.com/api/v10/applications/${config.applicationId}/guilds/${guild}/commands`){await record({kind:'register',body:JSON.parse(init.body)});return Response.json({id:'140000000000000001'})}
 assert.equal(input,config.appOrigin+'/api/integrations/discord/gateway');assert.equal(init.method,'POST');const timestamp=init.headers['X-Penny-Timestamp'];assert.equal(init.headers['X-Penny-Signature'],createHmac('sha256',config.gatewaySecret).update(timestamp+init.body).digest('hex'))
 await record({kind:'delivery',body:JSON.parse(init.body)})
 if(reset&&JSON.parse(init.body).d.message_id===message){
  // Discord expires the session while Penny is still accepting its old event.
  latestSocket.close(Number(reset));await new Promise(resolve=>setTimeout(resolve,75))
  return Response.json({accepted:true},{status:202})
 }
 if(process.env.PENNY_DISCORD_EDGE_CRASH==='1')process.kill(process.pid,'SIGKILL')
 if(!reset)setTimeout(()=>process.kill(process.pid,'SIGTERM'),150)
 return Response.json({accepted:true},{status:202})
}
class Gateway extends EventTarget{
 static OPEN=1
 readyState=1
 constructor(url){super();this.generation=++connection;latestSocket=this;assert.match(url,/^wss:\/\/gateway\.discord\.gg\/\?v=10&encoding=json$/);queueMicrotask(()=>this.packet({op:10,d:{heartbeat_interval:45000}}))}
 packet(value){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(value)}))}
 send(text){const value=JSON.parse(text)
  if(value.op===1){queueMicrotask(()=>this.packet({op:11,d:null}));return}
  if(value.op===2&&reset){
   const first=this.generation===1
   void(async()=>{
    if(!first)await record({kind:'reset-cursor',cursor:JSON.parse(await readFile(process.argv[3],'utf8'))})
    this.packet({op:0,t:'READY',s:first?100:1,d:{session_id:first?'expired-session':'replacement-session',resume_gateway_url:'wss://gateway.discord.gg/'}})
    const packet=reaction(channel);packet.s=first?101:2;if(!first)packet.d.message_id='130000000000000002'
    this.packet(packet)
    if(!first)setTimeout(()=>process.kill(process.pid,'SIGTERM'),200)
   })();return
  }
  if(value.op===2){assert.equal(value.d.intents,1024,'Only reaction metadata is subscribed');void record({kind:'identify'});queueMicrotask(()=>{this.packet({op:0,t:'READY',s:1,d:{session_id:'synthetic-session',resume_gateway_url:'wss://gateway.discord.gg/'}});this.packet(reaction(channel));this.packet(reaction('120000000000000003'))})}
  else if(value.op===6){assert.equal(value.d.session_id,'synthetic-session');assert.equal(value.d.seq,1);void record({kind:'resume'});queueMicrotask(()=>{this.packet(reaction(channel));this.packet(reaction('120000000000000003'))})}
 }
 close(code=1000){if(this.readyState!==1)return;this.readyState=3;const event=new Event('close');event.code=code;this.dispatchEvent(event)}
}
globalThis.WebSocket=Gateway
