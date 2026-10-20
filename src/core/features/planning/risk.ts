import type {PlanningItem,ReleasePlan} from './types'
/** A free-text window is not guessed. ISO days, months and quarters have explicit ends. */
export function windowEnd(value:string|null):string|null {
 if(!value)return null
 if(/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value)return value
 if(/^\d{4}-(0[1-9]|1[0-2])$/.test(value))return new Date(Date.UTC(Number(value.slice(0,4)),Number(value.slice(5)),0)).toISOString().slice(0,10)
 if(/^\d{4}-Q[1-4]$/.test(value))return new Date(Date.UTC(Number(value.slice(0,4)),Number(value.slice(-1))*3,0)).toISOString().slice(0,10)
 return null
}
export function markDependencyRisks(items:PlanningItem[],plans:ReleasePlan[],today:string){
 const byId=new Map(items.map(item=>[item.id,item]))
 const deadline=(item:PlanningItem)=>[windowEnd(item.targetWindow),...plans.filter(p=>p.itemIds.includes(item.id)).map(p=>p.releaseDate)].filter((d):d is string=>!!d).sort()[0]??null
 for(const item of items){
  if(item.status==='shipped'||item.status==='dropped')continue
  const pending=[...item.blockers],seen=new Set<string>()
  while(pending.length){
   const id=pending.shift()!;if(seen.has(id))continue;seen.add(id)
   const blocker=byId.get(id);if(!blocker||blocker.status==='shipped')continue
   const end=deadline(blocker),due=deadline(item),eta=windowEnd(item.publicEta)
   const reason=blocker.status==='dropped'?'Blocker was dropped':end&&end<today?'Blocker is past its delivery date':end&&due&&end>due?'Blocker is scheduled after this item':end&&eta&&end>eta?'Blocker is scheduled after the approved public ETA':null
   if(reason)item.risks.push({id,title:blocker.title,reason})
   pending.push(...blocker.blockers)
  }
 }
}
