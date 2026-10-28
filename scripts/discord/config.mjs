import {open} from 'node:fs/promises'
import {constants} from 'node:fs'
export async function privateJson(path){
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const stat=await file.stat();if(!stat.isFile()||stat.size>16384||(stat.mode&0o777)!==0o600||stat.uid!==process.getuid())throw Error('Configuration must be an owner-only regular file (0600).');return JSON.parse(await file.readFile('utf8'))}finally{await file.close()}
}
export function gatewayUrl(value){
 const url=new URL(value)
 if(url.protocol!=='wss:'||!/^gateway(?:-[a-z0-9-]+)?\.discord\.gg$/.test(url.hostname)||url.username||url.password||url.port||url.pathname!=='/')throw Error('Discord gateway URL refused')
 url.search='?v=10&encoding=json';return url.href
}
export function configuration(value){
 const id=value=>typeof value==='string'&&/^[0-9]{17,20}$/.test(value)
 const url=new URL(value.appOrigin)
 if(url.protocol!=='https:'||url.origin!==value.appOrigin||url.username||url.password||!id(value.applicationId)||typeof value.botToken!=='string'||value.botToken.length<20||typeof value.gatewaySecret!=='string'||value.gatewaySecret.length<32||!id(value.guildId)||!Array.isArray(value.channelIds)||!value.channelIds.length||value.channelIds.length>50||!value.channelIds.every(id))throw Error('Discord relay configuration invalid')
 return value
}
