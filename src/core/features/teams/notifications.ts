import {validNotificationUrl} from './notifications-url'
import type {PennyRuntime} from '@/core/app/runtime'
import {guardedDatabase} from '../integrations/guarded-database'
import {workspaceClock} from '../settings/workspace-clock'
import {teamsConfiguration,teamsWire} from './configuration'
type Event={id:string;operator_id:string;event:string;cadence:string;revision:number;created_at:string}
function period(at:string,timezone:string,weekly:boolean){
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at))
 if(!weekly)return date
 const day=new Date(date+'T00:00:00Z');day.setUTCDate(day.getUTCDate()-(day.getUTCDay()+6)%7)
 return day.toISOString().slice(0,10)
}
// Find local calendar boundaries without assuming a 24-hour day across DST.
// The query claims the entire closed period even when discovery is paged.
function periodStart(bucket:string,timezone:string,weekly:boolean){
 let low=Date.parse(bucket+'T00:00:00Z')-36*3600000,high=low+72*3600000
 while(high-low>1){const middle=Math.floor((low+high)/2);if(period(new Date(middle).toISOString(),timezone,weekly)<bucket)low=middle;else high=middle}
 return new Date(high).toISOString()
}
export async function drainTeamsNotifications(runtime:PennyRuntime,clock=Date.now()){
 const raw=runtime.database.binding,state=await raw.prepare("SELECT epoch FROM data_state WHERE singleton=1 AND phase='idle'").first<{epoch:number}>()
 if(!state)return
 const db=guardedDatabase(raw,{sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?)",params:[state.epoch]}),now=new Date(clock).toISOString()
 await db.prepare("UPDATE penny_teams_deliveries SET state='unknown',failure='interrupted_send_review_required',updated_at=? WHERE state='sending' AND updated_at<=?").bind(now,new Date(clock-300000).toISOString()).run()
 const config=teamsConfiguration(runtime)
 if(!config?.notificationUrl||!runtime.bindings.PENNY_TEAMS_EGRESS)return
 if(!validNotificationUrl(config.notificationUrl))return
 const {timezone}=await workspaceClock(runtime)
 // Filter open calendar periods before bounding discovery. A quiet weekly
 // backlog must never hide an immediate event behind the discovery limit.
 const dailyBoundary=periodStart(period(now,timezone,false),timezone,false)
 const weeklyBoundary=periodStart(period(now,timezone,true),timezone,true)
 const rows=(await db.prepare(`SELECT e.* FROM penny_teams_events e JOIN penny_teams_preferences p ON p.operator_id=e.operator_id AND p.revision=e.revision AND p.enabled=1 JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email AND n.status='active' WHERE e.delivery_id IS NULL AND (e.cadence='immediate' OR (e.cadence='daily' AND e.created_at<?) OR (e.cadence='weekly' AND e.created_at<?)) ORDER BY e.created_at,e.id LIMIT 200`).bind(dailyBoundary,weeklyBoundary).all<Event>()).results
 const groups=new Map<string,Event[]>()
 for(const row of rows){
  const bucket=row.cadence==='immediate'?row.id:period(row.created_at,timezone,row.cadence==='weekly')
  if(row.cadence!=='immediate'&&bucket>=period(now,timezone,row.cadence==='weekly'))continue
  const key=[row.operator_id,row.revision,row.cadence,bucket].join('/')
  groups.set(key,[...(groups.get(key)??[]),row])
 }
 for(const events of groups.values()){
  const first=events[0],id=crypto.randomUUID()
  let selection='id=?',selectionValues:(string|number)[]=[first.id]
  if(first.cadence!=='immediate'){
   const weekly=first.cadence==='weekly',bucket=period(first.created_at,timezone,weekly),end=new Date(bucket+'T00:00:00Z')
   end.setUTCDate(end.getUTCDate()+(weekly?7:1))
   selection='created_at>=? AND created_at<?'
   selectionValues=[periodStart(bucket,timezone,weekly),periodStart(end.toISOString().slice(0,10),timezone,weekly)]
  }
  const where='operator_id=? AND revision=? AND cadence=? AND delivery_id IS NULL AND '+selection
  const values=[first.operator_id,first.revision,first.cadence,...selectionValues]
  const guard={sql:`EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?) AND EXISTS(SELECT 1 FROM penny_teams_preferences p JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email WHERE p.operator_id=? AND p.enabled=1 AND p.revision=? AND n.status='active')`,params:[state.epoch,first.operator_id,first.revision] as (string|number|null)[]}
  const owned=guardedDatabase(raw,guard)
  await owned.batch([
   owned.prepare("INSERT INTO penny_teams_deliveries(id,operator_id,revision,state,event_count,created_at,updated_at) SELECT ?,?,?,'pending',count(*),?,? FROM penny_teams_events WHERE "+where+" HAVING count(*)>0").bind(id,first.operator_id,first.revision,now,now,...values),
   owned.prepare('UPDATE penny_teams_events SET delivery_id=? WHERE '+where+' AND EXISTS(SELECT 1 FROM penny_teams_deliveries WHERE id=?)').bind(id,...values,id),
  ])
 }
 const deliveries=(await db.prepare("SELECT id,operator_id,revision,event_count FROM penny_teams_deliveries WHERE state='pending' ORDER BY created_at,id LIMIT 20").all<{id:string;operator_id:string;revision:number;event_count:number}>()).results
 for(const item of deliveries){
  const claim=crypto.randomUUID()
  const claimed=await db.prepare(`UPDATE penny_teams_deliveries SET state='sending',claim=?,updated_at=? WHERE id=? AND state='pending' AND EXISTS(SELECT 1 FROM penny_teams_preferences p JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email WHERE p.operator_id=penny_teams_deliveries.operator_id AND p.revision=penny_teams_deliveries.revision AND p.enabled=1 AND n.status='active') RETURNING id`).bind(claim,now,item.id).all()
  if(!claimed.results.length)continue
  let outcome='unknown',failure:string|null='send_outcome_unknown_review_required'
  try{
   const events=(await db.prepare('SELECT event,count(*) total FROM penny_teams_events WHERE delivery_id=? GROUP BY event ORDER BY event').bind(item.id).all<{event:string;total:number}>()).results
   // No excerpt, identity, account, title, note or credential reaches a channel.
   const text='Penny operator update: '+events.map(e=>e.event+': '+e.total).join(', ')+'. Open Penny: '+runtime.configuration.appOrigin+'/app'
   const active=await db.prepare(`SELECT 1 FROM penny_teams_deliveries d JOIN penny_teams_preferences p ON p.operator_id=d.operator_id AND p.revision=d.revision AND p.enabled=1 JOIN operators o ON o.id=p.operator_id JOIN oa_operators n ON n.email=o.email AND n.status='active' WHERE d.id=? AND d.claim=? AND d.state='sending'`).bind(item.id,claim).first()
   if(!active)continue
   if(runtime.bindings.RER_DEMO==='1'){
    await db.prepare("UPDATE penny_teams_deliveries SET state='stopped',failure='demo_send_suppressed',updated_at=? WHERE id=? AND claim=? AND state='sending'").bind(now,item.id,claim).run()
    continue
   }
   const response=await teamsWire(runtime,config.notificationUrl,'POST',{'Content-Type':'application/json'},JSON.stringify({type:'message',attachments:[{contentType:'application/vnd.microsoft.card.adaptive',contentUrl:null,content:{$schema:'http://adaptivecards.io/schemas/adaptive-card.json',type:'AdaptiveCard',version:'1.2',body:[{type:'TextBlock',text,wrap:true}]}}]}))
   if(response.status>=200&&response.status<300){outcome='accepted';failure=null}
   else if([400,401,403,404,429].includes(response.status)){outcome='failed';failure=response.status===429?'teams_rate_limited':'teams_notification_rejected'}
  }catch{/* An ambiguous post is never automatically replayed. */}
  await db.prepare("UPDATE penny_teams_deliveries SET state=?,failure=?,updated_at=? WHERE id=? AND claim=? AND state='sending'").bind(outcome,failure,now,item.id,claim).run()
 }
}
