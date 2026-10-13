import { applyD1Migrations,reset } from 'cloudflare:test'
import { afterEach,beforeEach,expect,inject,it,vi } from 'vitest'
import { Buffer } from 'node:buffer'
import { call,env,messages,mockMail,owner } from './support'
import { apply,complete,counts,importPath,preview } from './feedback-import-fixture'
import { created,defaultIdeas,defaultVoters,ideaHeadings,largeUservoiceFixture,pagedUservoiceFixture,uservoiceCsv,uservoiceFixture } from './uservoice-fixture'
import { stableFeedbackId } from '@/core/features/imports/mapping-support'
import type { FeedbackReceipt } from '@/core/features/imports/receipt'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
const receiptOf=async(id:string,operator:Record<string,string>)=>await(await call(importPath+'/jobs/'+id+'/receipt',undefined,operator)).json() as FeedbackReceipt
const count=async(table:string)=>(await env.DB.prepare('SELECT COUNT(*) n FROM '+table).first<{n:number}>())!.n
const inert=['requester_addresses','requester_update_permissions','native_requester_sessions','request_follows','request_follow_contributions','notification_outbox','notification_intents','accounts','requester_account_links']

it('[IMP-008][IMP-007] previews, applies, replays and reverses UserVoice ideas with their supporters and a filtered-history warning',async()=>{
 const operator=await owner(),source=uservoiceFixture()
 const response=await call(importPath+'/preview',source,operator);expect(response.status,await response.clone().text()).toBe(200)
 const planned=await response.json() as {fingerprint:string;receipt:FeedbackReceipt}
 // Five voters are claimed for idea 101 and two for 102; five individual
 // supporters are supplied, so two remain aggregate-only and create nothing.
 expect(planned.receipt.uservoice).toEqual({files:[{name:'ideas.csv',version:'uservoice-ideas-csv',scope:'filtered',filter:'Status: open ideas; Forum: Product ideas'},{name:'voters.csv',version:'uservoice-voters-csv',scope:'filtered',filter:'Status: open ideas; Forum: Product ideas'}],ideas:2,voterRows:6,supporters:5,groupedRows:1,claimed:{field:'Voters Count',total:7,ideas:2,supplied:5},aggregateOnly:2,supporterTypes:{proxy:1,unmarked:4},proxyDistinguishable:true})
 expect(planned.receipt.aggregates).toEqual([{field:'Voters Count',category:'count',total:7,rows:2},{field:'Total Revenue',category:'revenue',total:1200.5,rows:1}])
 for(const field of ['Idea Creator Email Address','Parent ID','Moderation State','Internal Status Name','cv_Priority','Portal URL'])expect(planned.receipt.omissions.find(row=>row.kind==='posts'&&row.field===field),field).toBeDefined()
 for(const field of ['User Email Address','Account Name','Subscribed','Feedback Description','Idea Title'])expect(planned.receipt.omissions.find(row=>row.kind==='votes'&&row.field===field),field).toBeDefined()
 expect(planned.receipt.unresolved).toEqual([])
 const job=await apply(source,operator),before=await counts()
 expect(before).toMatchObject({requests:2,requesters:4,request_vote_contributions:5,request_votes:5,evidence_items:2,request_comments:0})
 const request=(key:string)=>stableFeedbackId(source.namespace,'posts',key),person=(user:string)=>stableFeedbackId(source.namespace,'users','uservoice-user:'+user)
 expect(await env.DB.prepare('SELECT title,description,author_requester_id,moderation_state,public_state,created_at FROM requests WHERE id=?').bind(request('101')).first()).toEqual({title:'Keyboard, labels',description:'Exact café "quote"\r\nSecond line',author_requester_id:person('c1'),moderation_state:'awaiting_review',public_state:'under_review',created_at:created})
 expect(await env.DB.prepare('SELECT description,author_requester_id,public_state FROM requests WHERE id=?').bind(request('102')).first()).toEqual({description:'Dark mode',author_requester_id:null,public_state:'open'})
 expect(await env.DB.prepare("SELECT v.wording FROM evidence_versions v JOIN evidence_items e ON e.id=v.evidence_id WHERE e.source_label LIKE '%Idea ID 101 (UserVoice)'").first('wording')).toBe('Exact café "quote"\r\nSecond line')
 expect((await env.DB.prepare('SELECT request_id,requester_id,supporter_type,created_at FROM request_vote_supporter_types ORDER BY request_id,requester_id').all()).results).toEqual([
  {request_id:request('101'),requester_id:person('c1'),supporter_type:'unmarked',created_at:created},{request_id:request('101'),requester_id:person('u1'),supporter_type:'unmarked',created_at:created},{request_id:request('101'),requester_id:person('u2'),supporter_type:'proxy',created_at:created},
  {request_id:request('102'),requester_id:person('u1'),supporter_type:'unmarked',created_at:created},{request_id:request('102'),requester_id:person('u3'),supporter_type:'unmarked',created_at:created},
 ].sort((a,b)=>a.request_id.localeCompare(b.request_id)||a.requester_id.localeCompare(b.requester_id)))
 for(const table of inert)expect(await count(table),table).toBe(0)
 const receipt=await receiptOf(job.id,operator)
 expect(receipt.uservoice).toEqual(planned.receipt.uservoice);expect(receipt.effects).toEqual({mail:0,notifications:0})
 for(const entry of receipt.destinations)expect(await count(entry.table),entry.table).toBe(entry.created)
 const context=await(await call('/api/operator/requests/feedback-'+request('101').toLowerCase()+'/context',undefined,operator)).json() as {voters:{displayName:string;supporterType:string|null}[]}
 expect(context.voters.map(row=>[row.displayName,row.supporterType]).sort()).toEqual([['Alex','unmarked'],['Bea','proxy'],['Creator Café','unmarked']])
 expect((await apply(source,operator)).id).toBe(job.id);expect(await counts()).toEqual(before)
 const changed=structuredClone(source);changed.files[1].base64=Buffer.from(Buffer.from(changed.files[1].base64,'base64').toString().replace('Alex,alex@','Alexandra,alex@')).toString('base64')
 const changedPreview=await preview(changed,operator);expect(changedPreview.counts.rejected).toBeGreaterThan(0)
 expect((await call(importPath+'/apply',{source:changed,fingerprint:changedPreview.fingerprint},operator)).status).toBe(422);expect(await counts()).toEqual(before)
 const originals=await(await call(importPath+'/jobs/'+job.id+'/originals',undefined,operator)).json() as {name:string;original:{base64:string}}[]
 for(const file of source.files)expect(originals.find(row=>row.name===file.name)?.original.base64).toBe(file.base64)
 const undo=await call(importPath+'/jobs/'+job.id+'/undo',{},operator);expect(undo.status,await undo.clone().text()).toBe(200);await complete(await undo.json() as typeof job,operator)
 const reversed=await receiptOf(job.id,operator)
 expect(reversed.phase).toBe('undone');expect(reversed.uservoice).toEqual(receipt.uservoice);expect(reversed.destinations.every(row=>row.created===row.removed)).toBe(true)
 for(const table of ['requests','requesters','request_vote_contributions','request_votes','request_vote_supporter_types','evidence_items'])expect(await count(table),table).toBe(0)
 expect((await apply(source,operator)).id).not.toBe(job.id);expect(await counts()).toEqual(before)
})

it('[IMP-008][IMP-002] refuses unmapped statuses, unknown headings, workbooks and undeclared scope by name before any write',async()=>{
 const operator=await owner()
 const refusal=async(source:ReturnType<typeof uservoiceFixture>,text:string)=>{const response=await call(importPath+'/preview',source,operator);expect(response.status,await response.clone().text()).toBe(422);expect((await response.json() as {message:string}).message).toContain(text)}
 const unmapped=uservoiceFixture();unmapped.statuses={'Under Review':'under_review'};await refusal(unmapped,'Unmapped UserVoice status: (blank)')
 const unknown=uservoiceFixture();unknown.files[0].base64=Buffer.from(uservoiceCsv([...ideaHeadings,'Suggestion Score'],defaultIdeas.map(row=>[...row,'9']))).toString('base64');await refusal(unknown,'Unknown UserVoice heading: Suggestion Score')
 const workbook=uservoiceFixture();workbook.files[1]={...workbook.files[1],name:'voters.xlsx',base64:Buffer.concat([Buffer.from([0x50,0x4b,0x03,0x04]),Buffer.from('xl/workbook.xml')]).toString('base64')};await refusal(workbook,'save it as "CSV UTF-8 (Comma delimited)"')
 const undeclared=uservoiceFixture();delete undeclared.files[1].uservoice!.scope;await refusal(undeclared,'scope as complete or filtered')
 const mixed=uservoiceFixture();mixed.files[0].base64=mixed.files[1].base64;await refusal(mixed,'Ideas & Voters export')
 expect(await count('ik_jobs')).toBe(0);expect((await counts()).requests).toBe(0)
})

it('[IMP-008][IMP-001][REQ-010] keeps 300 imported supporters inert, unmerged and private from requesters and public pages',async()=>{
 mockMail()
 const operator=await owner(),source=largeUservoiceFixture(),job=await apply(source,operator)
 expect(job.state).toBe('completed')
 expect((await counts()).request_vote_contributions).toBe(300)
 // The shared address belongs to two UserVoice User IDs: two people, never one.
 expect(await count('requesters')).toBe(296)
 expect((await env.DB.prepare("SELECT COUNT(*) n FROM requesters WHERE display_name IN ('Shared Person','Other Person')").first<{n:number}>())!.n).toBe(2)
 for(const table of [...inert,'requester_notification_preferences','request_notification_mutes'])expect(await count(table),table).toBe(0)
 expect(await count('oa_operators')).toBe(1);expect(await count('oa_sessions')).toBe(1)
 // A real person signing in with the imported address is a new requester who
 // sees none of the historical support and no other supporter.
 const email='same@example.test';expect((await call('/api/public/identity/email',{email,displayName:'Signed in later'})).status).toBe(202)
 const token=new URLSearchParams(new URL(messages.findLast(message=>message.to===email)!.url).hash.slice(1)).get('token'),verified=await call('/api/public/identity/email/verify',{token});expect(verified.status).toBe(200)
 const auth={Authorization:'Bearer '+(await verified.json() as {token:string}).token},activity=await call('/api/public/requester/activity',undefined,auth)
 expect(activity.status).toBe(200);const visible=await activity.text()
 for(const text of ['Shared Person','Other Person','Supporter 7','supporter7@example.test','Historical idea'])expect(visible).not.toContain(text)
 const slug='feedback-'+stableFeedbackId(source.namespace,'posts','1000').toLowerCase()
 const approved=await call('/api/operator/moderation/'+slug,{verdict:'approved',title:'Reviewed idea',description:'Reviewed wording',boardSlug:'import-'+stableFeedbackId(source.namespace,'boards','uv-board').toLowerCase(),displayName:'Reviewed requester'},operator)
 expect(approved.status,await approved.clone().text()).toBe(200)
 const published=await call('/api/public/requests/'+slug);expect(published.status).toBe(200)
 const card=await published.json() as {voteCount:number};expect(card.voteCount).toBe(10)
 const pages=[JSON.stringify(card),await(await call('/api/public/requests')).text(),await(await call('/portal/feedback/'+slug,undefined,{Accept:'text/html'})).text()]
 for(const page of pages)for(const text of ['Shared Person','same@example.test','Supporter 30','supporter30@example.test','acct','proxy','uservoice-user'])expect(page).not.toContain(text)
 expect(await count('notification_outbox')).toBe(0);expect(await count('notification_intents')).toBe(0)
},60000)

async function finishErasure(response:Response,operator:Record<string,string>){
 expect([200,202],await response.clone().text()).toContain(response.status);let result=await response.json() as {operationId:string;status:string}
 for(let step=0;step<100&&result.status!=='complete';step++){const next=await call('/api/operator/data/operations/'+result.operationId+'/resume',{},operator);expect([200,202],await next.clone().text()).toContain(next.status);result=await next.json() as typeof result}
 expect(result.status).toBe('complete')
}
it.each(['requesters','requests'] as const)('[IMP-008][IMP-004][IMP-005] fences undo behind later native votes and erases a UserVoice %s with its originals and a replay fence',async table=>{
 mockMail()
 const operator=await owner(),source=uservoiceFixture('uservoice-erasure-'+table),job=await apply(source,operator)
 const slug='feedback-'+stableFeedbackId(source.namespace,'posts','101').toLowerCase()
 expect((await call('/api/operator/moderation/'+slug,{verdict:'approved',title:'Reviewed idea',description:'Reviewed wording',boardSlug:'import-'+stableFeedbackId(source.namespace,'boards','uv-board').toLowerCase(),displayName:'Reviewed requester'},operator)).status).toBe(200)
 const email='later@example.test';expect((await call('/api/public/identity/email',{email,displayName:'Later native supporter'})).status).toBe(202)
 const token=new URLSearchParams(new URL(messages.findLast(message=>message.to===email)!.url).hash.slice(1)).get('token'),verified=await call('/api/public/identity/email/verify',{token})
 const person={Authorization:'Bearer '+(await verified.json() as {token:string}).token}
 expect((await call('/api/public/requests/'+slug+'/vote',{},person)).status).toBe(204)
 const kept=async()=>(await env.DB.batch(['request_vote_contributions','request_vote_supporter_types','requests','evidence_items'].map(name=>env.DB.prepare('SELECT * FROM '+name+' ORDER BY rowid')))).map(result=>result.results)
 const before=await kept();expect((await call(importPath+'/jobs/'+job.id+'/undo',{},operator)).status).toBe(409);expect(await kept()).toEqual(before)
 // u2 and u3 share a name and an address. Erasing either would rewrite the
 // other person's retained copy, so it is refused rather than guessed.
 const shared=await(await call('/api/operator/data/erasure/preview',{table:'requesters',id:stableFeedbackId(source.namespace,'users','uservoice-user:u2')},operator)).json() as {planHash:string;blockedCopies:unknown[]}
 expect(shared.blockedCopies.length).toBeGreaterThan(0);expect((await call('/api/operator/data/erasure',{table:'requesters',id:stableFeedbackId(source.namespace,'users','uservoice-user:u2'),planHash:shared.planHash},operator)).status).toBe(409)
 const id=table==='requesters'?stableFeedbackId(source.namespace,'users','uservoice-user:u1'):stableFeedbackId(source.namespace,'posts','102')
 const rows={before:Object.fromEntries(await Promise.all(['requesters','requests','request_vote_contributions','request_vote_supporter_types','evidence_items','feedback_import_records','ik_d1_original_chunks','ik_d1_erased_targets'].map(async name=>[name,await count(name)])))}
 const previewResponse=await call('/api/operator/data/erasure/preview',{table,id},operator);expect(previewResponse.status,await previewResponse.clone().text()).toBe(200)
 const plan=await previewResponse.json() as {planHash:string;blockedCopies:unknown[]};expect(plan.blockedCopies).toEqual([])
 await finishErasure(await call('/api/operator/data/erasure',{table,id,planHash:plan.planHash},operator),operator)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM '+table+' WHERE id=?').bind(id).first('n')).toBe(0)
 expect(await count('ik_d1_original_chunks')).toBe(0)
 const withdrawn=await(await call(importPath+'/jobs/'+job.id+'/originals',undefined,operator)).text();for(const file of source.files)expect(withdrawn).not.toContain(file.base64)
 // Unrelated people and the later native vote survive the erasure.
 expect(await env.DB.prepare("SELECT COUNT(*) n FROM requesters WHERE display_name='Later native supporter'").first('n')).toBe(1)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM requesters WHERE id=?').bind(stableFeedbackId(source.namespace,'users','uservoice-user:c1')).first('n')).toBe(1)
 const after=Object.fromEntries(await Promise.all(Object.keys(rows.before).map(async name=>[name,await count(name)])))
 expect(after.request_vote_supporter_types).toBeLessThan(rows.before.request_vote_supporter_types);expect(after.ik_d1_erased_targets).toBeGreaterThan(rows.before.ik_d1_erased_targets)
 const replay=await preview(source,operator),refused=await call(importPath+'/apply',{source,fingerprint:replay.fingerprint},operator)
 expect(refused.status).toBe(422);expect(await env.DB.prepare('SELECT COUNT(*) n FROM '+table+' WHERE id=?').bind(id).first('n')).toBe(0)
},60000)

it('[IMP-008][IMP-005] a paged UserVoice import keeps every supporter and erases one whose votes fall on two pages',async()=>{
 mockMail()
 const operator=await owner(),source=pagedUservoiceFixture(),job=await apply(source,operator)
 expect(job.state).toBe('completed');expect(await count('ik_d1_stream_pages')).toBeGreaterThan(1)
 // Every supporter row is a distinct person and idea, so each one is a vote.
 const rows=Buffer.from(source.files[1].base64,'base64').toString().trim().split('\r\n').length-1
 expect(await count('request_vote_contributions')).toBe(rows);expect(await count('request_vote_supporter_types')).toBe(rows)
 const id=stableFeedbackId(source.namespace,'users','uservoice-user:spanning')
 const votes=async()=>(await env.DB.prepare('SELECT COUNT(*) n FROM request_vote_contributions WHERE requester_id=?').bind(id).first<{n:number}>())!.n
 expect(await votes()).toBe(2)
 const previewResponse=await call('/api/operator/data/erasure/preview',{table:'requesters',id},operator);expect(previewResponse.status,await previewResponse.clone().text()).toBe(200)
 const plan=await previewResponse.json() as {planHash:string;blockedCopies:unknown[]};expect(plan.blockedCopies).toEqual([])
 await finishErasure(await call('/api/operator/data/erasure',{table:'requesters',id,planHash:plan.planHash},operator),operator)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM requesters WHERE id=?').bind(id).first('n')).toBe(0)
 expect(await votes()).toBe(0);expect(await count('request_vote_contributions')).toBe(rows-2)
},120000)
