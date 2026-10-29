// Run under a process supervisor. State contains only Discord's session cursor;
// authentication lives in the separate owner-only deployment configuration.
import {writeFile,rename,open,unlink} from 'node:fs/promises'
import {createHmac} from 'node:crypto'
import {resolve} from 'node:path'
import {configuration,privateJson,gatewayUrl} from './config.mjs'
const [configPath,statePath]=process.argv.slice(2)
if(!configPath||!statePath){console.error('Usage: node scripts/discord/relay.mjs <private-config.json> <private-state.json>');process.exit(2)}
let lock,stopping=false,socket,timer,finish,active
try{
 if(resolve(configPath)===resolve(statePath))throw Error('Separate configuration and cursor paths required')
 const config=configuration(await privateJson(configPath))
 lock=await open(statePath+'.lock','wx',0o600)
 let state={sequence:null,sessionId:null,resumeUrl:null}
 try{state=await privateJson(statePath)}catch(error){if(error.code!=='ENOENT')throw error}
 if(!((state.sequence===null||Number.isSafeInteger(state.sequence))&&(state.sessionId===null||typeof state.sessionId==='string')&&(state.resumeUrl===null||typeof state.resumeUrl==='string')))throw Error('Gateway cursor invalid')
 const save=async()=>{const temporary=statePath+'.'+process.pid+'.new';await writeFile(temporary,JSON.stringify(state)+'\n',{mode:0o600,flag:'wx'});await rename(temporary,statePath)}
 const stop=()=>{stopping=true;clearInterval(timer);socket?.close(1000);finish?.()}
 process.once('SIGINT',stop);process.once('SIGTERM',stop)
 const meta=await fetch('https://discord.com/api/v10/gateway/bot',{headers:{Authorization:`Bot ${config.botToken}`},redirect:'error',signal:AbortSignal.timeout(15000)})
 if(!meta.ok)throw Error('Discord Gateway discovery refused; check bot token')
 const gateway=gatewayUrl((await meta.json()).url)
 let failures=0
 while(!stopping){
  let acknowledged=true,chain=Promise.resolve(),failed=false,queued=0,resetSession=false,fatalError
  await new Promise(resolve=>{
   finish=resolve;const client=new WebSocket(state.resumeUrl?gatewayUrl(state.resumeUrl):gateway);socket=client
   const send=body=>{if(client.readyState===WebSocket.OPEN)client.send(JSON.stringify(body))}
   const heartbeat=()=>{if(!acknowledged){failed=true;client.close(4000);return}acknowledged=false;send({op:1,d:state.sequence})}
   client.addEventListener('message',event=>{if(++queued>1000){failed=true;client.close(4000);return}chain=chain.then(async()=>{
    if(failed||stopping)return
    if(typeof event.data!=='string'||Buffer.byteLength(event.data)>65536)throw Error('Gateway payload bound exceeded')
    const packet=JSON.parse(event.data)
    if(packet.op===10){
     const interval=packet.d?.heartbeat_interval
     if(!Number.isFinite(interval)||interval<1000||interval>120000)throw Error('Gateway heartbeat interval invalid')
     clearInterval(timer);timer=setInterval(heartbeat,interval);heartbeat()
     send(state.sessionId?{op:6,d:{token:config.botToken,session_id:state.sessionId,seq:state.sequence}}:{op:2,d:{token:config.botToken,intents:1024,properties:{os:process.platform,browser:'Penny',device:'Penny'}}})
    }else if(packet.op===11)acknowledged=true
    else if(packet.op===1)heartbeat()
    else if(packet.op===7)client.close(4000)
    else if(packet.op===9){resetSession=packet.d!==true;client.close(4000)}
    else if(packet.op===0){
     if(!Number.isSafeInteger(packet.s)||packet.s<0)throw Error('Gateway sequence invalid')
     if(state.sequence!==null&&packet.s<=state.sequence)return
     if(packet.t==='RESUMED')failures=0
     if(packet.t==='READY'){state.sessionId=packet.d.session_id;state.resumeUrl=gatewayUrl(packet.d.resume_gateway_url);failures=0}
     if(packet.t==='MESSAGE_REACTION_ADD'){
      const d=packet.d
      if(d.guild_id===config.guildId&&config.channelIds.includes(d.channel_id)&&!d.member?.user?.bot){
       const user=d.member?.user,body=JSON.stringify({t:packet.t,d:{guild_id:d.guild_id,channel_id:d.channel_id,message_id:d.message_id,user_id:d.user_id,emoji:{id:d.emoji.id??null,name:d.emoji.name??null},...(user?{member:{user:{id:user.id,username:user.username,global_name:user.global_name??null,bot:user.bot??false}}}:{})}})
       const timestamp=String(Math.floor(Date.now()/1000)),signature=createHmac('sha256',config.gatewaySecret).update(timestamp+body).digest('hex')
       const result=await fetch(config.appOrigin+'/api/integrations/discord/gateway',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','X-Penny-Timestamp':timestamp,'X-Penny-Signature':signature},body,signal:AbortSignal.timeout(15000)})
       if(!result.ok)throw Error('Penny gateway delivery refused; cursor retained for resume')
       await result.body?.cancel()
      }
     }
     // Advance only after Penny has durably accepted this event. A crash before
     // this save replays the same message identity, never a second capture.
     state.sequence=packet.s;await save()
    }
   }).catch(()=>{failed=true;client.close(4000)}).finally(()=>{queued--})})
   client.addEventListener('close',event=>{clearInterval(timer);if([4004,4010,4011,4012,4013,4014].includes(event.code))fatalError=Error('Discord Gateway authentication/intents refused; fix configuration before restart');if([4007,4009].includes(event.code))resetSession=true;resolve()})
   client.addEventListener('error',()=>{failed=true;clearInterval(timer);client.close();resolve()})
  })
  active=chain;await active;clearInterval(timer)
  // Close callbacks never mutate the cursor under an outstanding delivery.
  // Settle every queued packet before discarding an expired session, and persist
  // that reset before identifying again (including after a supervisor restart).
  if(resetSession){state={sequence:null,sessionId:null,resumeUrl:null};await save()}
  if(fatalError)throw fatalError
  if(stopping)break
  if(failed)console.error('Discord relay interrupted; resuming from the last accepted cursor')
  if(++failures>5)throw Error('Discord relay stopped after five connection failures; inspect and restart explicitly')
  await new Promise(resolve=>{const backoff=setTimeout(resolve,Math.min(30000,failures*5000));finish=()=>{clearTimeout(backoff);resolve()}})
 }
 await active
}catch{console.error('Discord relay stopped: configuration, connection or delivery failed. Check permissions, token, intent and Penny status. No message body logged.');process.exitCode=1}
finally{clearInterval(timer);socket?.close();if(lock){await lock.close();await unlink(statePath+'.lock')}}
