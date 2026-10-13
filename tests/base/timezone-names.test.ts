import { env } from 'cloudflare:workers'
import { expect, it } from 'vitest'
import { createPennyRuntime } from '@/core/app/runtime'
it('[NOTIFY-002] runtime timezone requires an IANA name and accepts named aliases',()=>{
 for(const WORKSPACE_TIMEZONE of ['+05:30','-08:00','+0530','+05','-2359'])expect(()=>createPennyRuntime({...env,WORKSPACE_TIMEZONE})).toThrow('IANA timezone')
 for(const WORKSPACE_TIMEZONE of ['UTC','Etc/UTC','Etc/GMT+5','Australia/Brisbane','US/Eastern'])expect(createPennyRuntime({...env,WORKSPACE_TIMEZONE}).configuration.workspaceTimezone).toBe(WORKSPACE_TIMEZONE)
 expect(createPennyRuntime(env).configuration.workspaceTimezone).toBe('Australia/Brisbane')
})
