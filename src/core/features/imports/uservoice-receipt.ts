import type { SourceRecord } from '../../../../base/modules/import-kit/src/types'
import { asObject } from './mapping-support'

export interface UserVoiceReceipt {
 files:{name:string;version:string;scope:string;filter:string|null}[]
 ideas:number
 voterRows:number
 supporters:number
 groupedRows:number
 claimed:{field:string;total:number;ideas:number;supplied:number}|null
 aggregateOnly:number|null
 supporterTypes:{proxy:number;unmarked:number}
 proxyDistinguishable:boolean
}
// Counts come from the reviewed source rows, so preview, applied and undone
// receipts report the same history the owner supplied.
export function uservoiceAccumulator(){
 const files=new Map<string,UserVoiceReceipt['files'][number]>(),ideas=new Map<string,{claimed:number|null;field:string|null}>(),supporters=new Map<string,{idea:string;rows:number;type:string;proxyColumns:boolean}>()
 const add=(record:SourceRecord)=>{
  const payload=asObject(record.payload)
  if(!['uservoice-ideas-csv','uservoice-voters-csv'].includes(String(payload._format)))return
  const meta=asObject(payload._uservoice)
  files.set(String(meta.file),{name:String(meta.file),version:String(payload._format),scope:String(meta.scope),filter:typeof meta.filter==='string'?meta.filter:null})
  if(payload._format==='uservoice-ideas-csv')ideas.set(record.sourceId,{claimed:typeof meta.claimed==='number'?meta.claimed:null,field:typeof meta.claimField==='string'?meta.claimField:null})
  else supporters.set(record.sourceId,{idea:String(payload.post),rows:Number(meta.rows),type:String(meta.supporterType),proxyColumns:meta.proxyColumns===true})
 }
 const finish=():UserVoiceReceipt|undefined=>{
  if(!files.size)return undefined
  const counted=[...ideas].filter(([,idea])=>idea.claimed!==null),field=counted[0]?.[1].field??null,claimedIdeas=new Set(counted.map(([key])=>key))
  const voterRows=[...supporters.values()].reduce((sum,item)=>sum+item.rows,0),supplied=[...supporters.values()].filter(item=>claimedIdeas.has(item.idea)).length
  const claimed=field?{field,total:counted.reduce((sum,[,idea])=>sum+idea.claimed!,0),ideas:counted.length,supplied}:null
  return {files:[...files.values()],ideas:ideas.size,voterRows,supporters:supporters.size,groupedRows:voterRows-supporters.size,claimed,aggregateOnly:claimed?claimed.total-supplied:null,
   supporterTypes:{proxy:[...supporters.values()].filter(item=>item.type==='proxy').length,unmarked:[...supporters.values()].filter(item=>item.type!=='proxy').length},
   proxyDistinguishable:[...supporters.values()].every(item=>item.proxyColumns)}
 }
 return {add,finish}
}
