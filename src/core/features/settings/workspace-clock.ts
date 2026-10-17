import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'

export const workspaceClockInput=z.object({
 timezone:z.string().trim().min(1).max(100).refine(value=>{
  try {if(/^[+-]/.test(value))return false;new Intl.DateTimeFormat('en',{timeZone:value}).format();return true}catch{return false}
 },'Choose an IANA timezone, such as America/New_York.'),
 quietEnabled:z.boolean(),quietStart:z.number().int().min(0).max(23),quietEnd:z.number().int().min(0).max(23),
}).strict().refine(value=>!value.quietEnabled||value.quietStart!==value.quietEnd,{message:'Quiet hours must have different start and end hours.'})
export type WorkspaceClockInput=z.infer<typeof workspaceClockInput>
export type WorkspaceClock=WorkspaceClockInput&{confirmed:boolean}

/** Read at each use, including the final send check: settings changes take effect
 * without restarting a Worker or retaining an old runtime's timezone. */
export async function workspaceClock(runtime:PennyRuntime):Promise<WorkspaceClock>{
 const row=await runtime.database.binding.prepare('SELECT timezone,quiet_enabled AS quietEnabled,quiet_start AS quietStart,quiet_end AS quietEnd FROM penny_workspace_clock WHERE singleton=1').first<WorkspaceClockInput>()
 if(row)return {...row,quietEnabled:Boolean(row.quietEnabled),confirmed:true}
 return {timezone:runtime.configuration.workspaceTimezone,quietEnabled:true,quietStart:20,quietEnd:8,confirmed:false}
}
export function withinQuietHours(now:Date,clock:WorkspaceClockInput):boolean{
 if(!clock.quietEnabled)return false
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:clock.timezone,hour:'2-digit',hourCycle:'h23'}).format(now))
 return clock.quietStart<clock.quietEnd?hour>=clock.quietStart&&hour<clock.quietEnd:hour>=clock.quietStart||hour<clock.quietEnd
}
export async function requesterQuietHours(runtime:PennyRuntime,now:Date):Promise<boolean>{return withinQuietHours(now,await workspaceClock(runtime))}
export function saveWorkspaceClock(db:D1Database,input:WorkspaceClockInput,now:string,firstRun=false):D1PreparedStatement{
 return db.prepare(`INSERT INTO penny_workspace_clock(singleton,timezone,quiet_enabled,quiet_start,quiet_end,confirmed_at,updated_at)
 SELECT 1,?,?,?,?,?,? ${firstRun?'WHERE NOT EXISTS(SELECT 1 FROM oa_first_run WHERE singleton=1)':''}
 ON CONFLICT(singleton) DO UPDATE SET timezone=excluded.timezone,quiet_enabled=excluded.quiet_enabled,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,updated_at=excluded.updated_at`)
 .bind(input.timezone,input.quietEnabled?1:0,input.quietStart,input.quietEnd,now,now)
}
