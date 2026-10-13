import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterEach,expect,inject,it,vi } from 'vitest'
import { call,env,requester } from './support'
import { releaseGraph } from './release-fixture'
import { rows,time } from './notification-regression-fixture'
import { publishRelease } from '@/core/features/releases/publication'
import { saveReleaseDraft } from '@/core/features/releases/drafts'
import { PublicReleasesReadRepository } from '@/core/features/releases/public-read-repository'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
it('[REL-001/002/003/004/005/010 DATA-002] private draft publishes one immutable version and complete deduplicated owned snapshot',async()=>{
 const g=await releaseGraph(),publicRead=new PublicReleasesReadRepository({binding:env.DB})
 expect(await publicRead.list()).toEqual([])
 await Promise.all([publishRelease(env.DB,g.draft.slug,time()),publishRelease(env.DB,g.draft.slug,time())])
 expect(await rows('release_recipient_snapshots')).toHaveLength(1)
 expect(await rows('release_recipient_contexts')).toHaveLength(2)
 expect(await rows('release_target_snapshots')).toHaveLength(2)
 expect((await rows('notification_outbox')).filter(r=>r.release_snapshot_id)).toHaveLength(1)
 const publicJson=JSON.stringify(await publicRead.list());expect(publicJson).toContain(g.input.title)
 for(const marker of ['Private','private-item-slug','private-decision-slug','outcomePrompt',g.recipient.email,g.recipient.requesterId])expect(publicJson).not.toContain(marker)
 await expect(saveReleaseDraft(env.DB,{...g.input,title:'Overwrite'},g.draft.slug,time())).rejects.toThrow('immutable')
 const before=await rows('release_recipient_snapshots')
 await call(`/api/public/requests/${g.requests[0].slug}/follow`,{},g.person,'DELETE')
 expect(await rows('release_recipient_snapshots')).toEqual(before)
 await publishRelease(env.DB,g.draft.slug,time());expect((await rows('notification_outbox')).filter(r=>r.release_snapshot_id)).toHaveLength(1)
})
it('[REL-002/004 DATA-001] late queue failure rolls back portal, headers, every context and outbox',async()=>{
 const g=await releaseGraph()
 await env.DB.exec("CREATE TRIGGER injected_release_queue_failure BEFORE INSERT ON notification_outbox WHEN NEW.release_snapshot_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'late queue failure'); END;")
 await expect(publishRelease(env.DB,g.draft.slug,time())).rejects.toThrow('late queue failure')
 for(const table of ['release_recipient_snapshots','release_recipient_contexts','release_target_snapshots'])expect(await rows(table)).toHaveLength(0)
 expect((await rows('releases'))[0].state).toBe('draft')
 expect((await rows('release_versions'))[0].publication_claim).toBeNull()
})
it.each(['title','body','targets','unshipped'] as const)('[REL-001/002] publication names missing %s inline',async field=>{
 const g=await releaseGraph()
 if(field==='unshipped')await env.DB.exec("UPDATE roadmap_items SET status='planned'")
 else await saveReleaseDraft(env.DB,{...g.input,...(field==='targets'?{targetIds:[]}:{[field]:''})},g.draft.slug,time())
 await expect(publishRelease(env.DB,g.draft.slug,time())).rejects.toThrow(field==='unshipped'?'Approved improvement: must be Shipped':field==='targets'?'At least one target':field==='title'?'Title':'Body')
 expect((await rows('releases'))[0].state).toBe('draft')
})
it.each(['mapping','wording','visibility','decision','extra-mapping'] as const)('[REL-002 ROAD-004] atomic approval witnesses refuse changed %s',async change=>{
 const g=await releaseGraph(3)
 if(change==='mapping')await env.DB.exec("UPDATE roadmap_request_mappings SET approved_at='later'")
 if(change==='wording')await env.DB.exec("UPDATE roadmap_publications SET public_title='Changed safe title'")
 if(change==='visibility')await env.DB.exec("UPDATE boards SET visibility='internal'")
 if(change==='decision')await env.DB.exec("UPDATE roadmap_items SET decision_id=NULL")
 if(change==='extra-mapping'){
  await env.DB.prepare('DELETE FROM release_draft_mappings WHERE request_id=?').bind(g.requests[2].id).run()
 }
 await expect(publishRelease(env.DB,g.draft.slug,time())).rejects.toThrow('changed')
 expect(await rows('release_recipient_snapshots')).toHaveLength(0)
})
it('[REL-004 REQ-010] vote without follow grants no release permission; empty audience still publishes',async()=>{
 const g=await releaseGraph(1)
 await call(`/api/public/requests/${g.requests[0].slug}/follow`,{},g.person,'DELETE')
 // A request mapped to a Shipped item closes voting, so the vote is cast while the item is still in progress.
 await env.DB.prepare("UPDATE roadmap_items SET status='in_progress' WHERE id='release-item'").run()
 const voter=await requester();expect((await call(`/api/public/requests/${g.requests[0].slug}/vote`,{},voter)).status).toBe(204)
 await env.DB.prepare("UPDATE roadmap_items SET status='shipped' WHERE id='release-item'").run()
 await publishRelease(env.DB,g.draft.slug,time())
 expect(await rows('release_recipient_snapshots')).toHaveLength(0);expect((await rows('releases'))[0].state).toBe('published')
})
it('[BASE-ACCESS-002/004 REL-001/002 ROAD-008] all release and status mutations require operator and same origin',async()=>{
 const g=await releaseGraph(),outsider=await requester()
 for(const [path,body,method] of [['/api/operator/releases',g.input,'POST'],[`/api/operator/releases/${g.draft.slug}`,g.input,'PATCH'],[`/api/operator/releases/${g.draft.slug}/publish`,{},'POST'],['/api/operator/roadmap-updates/missing/publish',{},'POST']] as const){
  expect((await call(path,body,{},method)).status).toBe(401)
  expect((await call(path,body,outsider,method)).status).toBe(401)
  expect((await call(path,body,{...g.operator,Origin:'https://foreign.example'},method)).status).toBe(403)
 }
})
it('[REL-004/006] complete publication snapshot exceeds a Cron page before the first provider command',async()=>{
 const g=await releaseGraph(1),stamp=time()
 for(let n=0;n<55;n++)await env.DB.batch([
  env.DB.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,?,?,?)').bind(`release-person-${n}`,`Person ${n}`,stamp,stamp),
  env.DB.prepare('INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(`release-address-${n}`,`release-person-${n}`,`release-${n}@example.test`,stamp,stamp,stamp),
  env.DB.prepare('INSERT INTO request_follows(request_id,requester_id,permission_granted_at,created_at,updated_at) VALUES(?,?,?,?,?)').bind(g.requests[0].id,`release-person-${n}`,stamp,stamp,stamp),
  env.DB.prepare("INSERT INTO requester_update_permissions(id,requester_id,requester_address_id,request_id,source,granted_at,created_at,updated_at) VALUES(?,?,?,?,'follow',?,?,?)").bind(`release-consent-${n}`,`release-person-${n}`,`release-address-${n}`,g.requests[0].id,stamp,stamp,stamp),
 ])
 await publishRelease(env.DB,g.draft.slug,stamp)
 expect(await rows('release_recipient_snapshots')).toHaveLength(56)
 expect((await rows('notification_outbox')).filter(r=>r.release_snapshot_id)).toHaveLength(56)
})
it('[REL-002/004 ROAD-004] mapping mutation between discovery and commit cannot publish stale approval',async()=>{
 const g=await releaseGraph(),db=new Proxy(env.DB,{get(target,key){if(key==='batch')return async(statements:D1PreparedStatement[])=>{await env.DB.exec("UPDATE roadmap_request_mappings SET withdrawn_at='concurrent'");return env.DB.batch(statements)};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
 await expect(publishRelease(db,g.draft.slug,time())).rejects.toThrow('changed')
 expect(await rows('release_recipient_snapshots')).toHaveLength(0);expect((await rows('releases'))[0].state).toBe('draft')
})
it('[REL-004/005 REQ-010] deterministic verified address chooses only contexts authorized for that address',async()=>{
 const g=await releaseGraph(),stamp=time()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind('secondary-address',g.recipient.requesterId,'secondary@example.test',stamp,stamp,stamp),
  env.DB.prepare("INSERT INTO requester_update_permissions(id,requester_id,requester_address_id,request_id,source,granted_at,created_at,updated_at) VALUES('secondary-consent',?,'secondary-address',?,'follow','2020-01-01T00:00:00.000Z',?,?)").bind(g.recipient.requesterId,g.requests[0].id,stamp,stamp),
 ])
 await publishRelease(env.DB,g.draft.slug,stamp)
 expect(await rows('release_recipient_snapshots')).toMatchObject([{requester_address_id:'secondary-address',recipient_email:'secondary@example.test'}])
 expect(await rows('release_recipient_contexts')).toMatchObject([{request_id:g.requests[0].id}])
 expect(await rows('release_recipient_contexts')).toHaveLength(1)
 const newcomer=await requester();expect((await call(`/api/public/requests/${g.requests[0].slug}/follow`,{},newcomer)).status).toBe(204)
 await publishRelease(env.DB,g.draft.slug,stamp);expect(await rows('release_recipient_snapshots')).toHaveLength(1)
})
it('[REL-005/010 DATA-002] empty public API and SSR expose no draft, example or outcome prompt',async()=>{
 const g=await releaseGraph()
 expect(await (await call('/api/public/releases')).json()).toEqual([])
 const response=await call('/portal/updates'),html=await response.text()
 expect(response.status).toBe(200);expect(html).toContain('There are no updates yet.')
 for(const marker of [g.input.title,'Private decision marker','outcomePrompt','Outcome prompt'])expect(html).not.toContain(marker)
})
