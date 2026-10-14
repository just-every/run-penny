import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,afterEach,expect,inject,it,vi} from 'vitest'
import {env} from './support'
import {graph} from './notification-regression-fixture'
import {connection,runtime,count} from './integration-delivery-fixture'
import {drainIntegrations,eventServices} from '@/core/features/integrations/delivery'
import {validateSlackMessage} from '../../base/modules/integrations/slack/message.ts'
import type {WireRequest} from '../../base/modules/integrations/core/types.ts'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
it('[INT-001 INT-003] composes the Base Slack notifier with native D1 and immutable safe Block Kit bytes',async()=>{
 const g=await graph(),target=await connection(g.operator,'slack'),sent:WireRequest[]=[]
 const port={send:async(wire:WireRequest)=>{sent.push(wire);validateSlackMessage(JSON.parse(wire.body));return {status:200,headers:{},body:'ok'}}}
 await g.publish(0,'Approved <update> & context')
 await drainIntegrations(runtime(port));await drainIntegrations(runtime(port))
 expect(sent).toHaveLength(1);expect(sent[0].url).toBe('https://hooks.slack.com/services/T123/B123/test-only-fixture')
 expect(sent[0].body).toContain('&lt;update&gt; &amp; context');expect(sent[0].body).not.toContain(g.recipient.email)
 expect(await count('integration_attempts')).toBe(1)
 const id=await env.DB.prepare('SELECT id FROM integration_deliveries').first<string>('id')
 expect((await eventServices(runtime(port)).slackSend.get(id!))?.state).toBe('accepted')
 expect(await env.DB.prepare('SELECT signing_key FROM penny_integration_credentials WHERE id=?').bind(target.id).first('signing_key')).toBeNull()
})
it('[INT-003 DATA-001] cannot deliver private/blocked content and holds restored events and uncertain attempts',async()=>{
 const g=await graph();await connection(g.operator,'slack');await g.publish(0,'Later held update')
 const sent:WireRequest[]=[],port={send:async(wire:WireRequest)=>{sent.push(wire);return {status:200,headers:{},body:'ok'}}}
 await env.DB.prepare('UPDATE requesters SET blocked_at=? WHERE id=?').bind(new Date().toISOString(),g.recipient.requesterId).run()
 await drainIntegrations(runtime(port));expect(sent).toHaveLength(0)
 expect(await count('integration_deliveries')).toBe(0)
 const {exportArchive}=await import('@/core/features/data/archive'),exported=await exportArchive(env.DB,env.FILES)
 expect(exported.archive.tables.penny_integration_events.every(row=>row.held===1)).toBe(true)
 expect(exported.archive.tables).not.toHaveProperty('penny_integration_credentials');// Destinations travel as revoked records; their endpoints and keys never do.
 expect(exported.archive.tables.penny_integration_destinations.length).toBeGreaterThan(0);expect(exported.archive.tables.penny_integration_destinations.every(row=>row.revoked_at!==null)).toBe(true)
})
