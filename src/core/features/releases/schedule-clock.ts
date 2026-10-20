import { MutationError } from '@/core/app/operator-mutations'

/** Resolve a wall clock in the workspace's IANA zone. A DST gap or repeated
 * hour needs another explicit choice; never silently move the operator's time. */
export function publicationInstant(localTime:string,timeZone:string):string {
 const wall=Date.parse(localTime+':00Z')
 if(!Number.isFinite(wall)||new Date(wall).toISOString().slice(0,16)!==localTime)throw new MutationError(422,'Choose a valid local date and time.')
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})
 const local=(instant:number)=>{
  const parts=Object.fromEntries(formatter.formatToParts(instant).map(part=>[part.type,part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
 }
 const offsets=new Set<number>()
 for(let hours=-36;hours<=36;hours+=6){const sample=wall+hours*3600000;offsets.add(Date.parse(local(sample)+'Z')-sample)}
 const matches=[...offsets].map(offset=>wall-offset).filter(instant=>local(instant)===localTime+':00')
 if(matches.length!==1)throw new MutationError(422,matches.length?'That time occurs twice in this timezone. Choose a time outside the repeated hour.':'That time does not exist in this timezone. Choose a time outside the clock change.')
 return new Date(matches[0]).toISOString()
}
