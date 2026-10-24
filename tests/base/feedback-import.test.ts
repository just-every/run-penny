import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,expect,inject,it } from 'vitest'
import { Buffer } from 'node:buffer'
import { call,env,owner } from './support'
import { apply,complete,counts,feedbackFixture,exportFeedbackFixture,importPath,preview } from './feedback-import-fixture'
import { stableFeedbackId } from '@/core/features/imports/mapping-support'
import type { SavedFeedbackInput } from '@/core/features/imports/types'
import classicCsv from '../fixtures/imports/classic.csv?raw'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})

it('[IMP-001][REQ-031][EVID-006] imports each configured input multi-board history without authority, consent or publication effects',async()=>{
 for(const family of ['api','export'] as const){
  await reset();await applyD1Migrations(env.DB,inject('migrations'))
  await (async()=>{
 const operator=await owner(),source=family==='api'?feedbackFixture():exportFeedbackFixture(),plan=await preview(source,operator)
 expect(plan.rows.filter(r=>r.kind==='votes'&&r.applied===0)).toHaveLength(1)
 const job=await apply(source,operator)
 const receipt=await(await call(importPath+'/jobs/'+job.id+'/receipt',undefined,operator)).json() as import('@/core/features/imports/receipt').FeedbackReceipt
 for(const row of receipt.destinations)expect(await env.DB.prepare('SELECT COUNT(*) n FROM '+row.table).first('n'),row.table).toBe(row.created)
 expect(receipt.effects).toEqual({mail:0,notifications:0})
 expect(await counts()).toEqual({boards:2,requesters:family==='api'?3:7,requests:4,request_vote_contributions:4,request_votes:3,request_comments:2,request_merges:2,tags:2,evidence_items:4,feedback_import_records:family==='api'?19:23})
 expect((await env.DB.prepare("SELECT COUNT(*) n FROM feedback_import_records WHERE attribution='historical-unverified'").first<{n:number}>())!.n).toBe(family==='api'?19:23)
 for(const table of ['requester_addresses','request_follows','requester_update_permissions','native_requester_sessions','notification_outbox','notification_intents','roadmap_publications','release_versions'])expect((await env.DB.prepare('SELECT COUNT(*) n FROM '+table).first<{n:number}>())!.n).toBe(0)
 expect((await env.DB.prepare('SELECT COUNT(*) n FROM oa_operators').first<{n:number}>())!.n).toBe(1)
 expect(await (await call('/api/public/boards')).text()).not.toContain('Private account')
 const root='feedback-'+stableFeedbackId(source.namespace,'posts',family==='api'?'post-0':'https://feedback.example.test/p/post-0').toLowerCase()
 const approved=await call('/api/operator/moderation/'+root,{verdict:'approved',title:'Reviewed historical request',description:'Reviewed historical wording',boardSlug:'import-'+stableFeedbackId(source.namespace,'boards','public-board').toLowerCase(),displayName:'Approved historical contributor'},operator)
 expect(approved.status,await approved.clone().text()).toBe(200)
 const publicText=await (await call('/api/public/requests/'+root)).text()
 expect(publicText).not.toContain('Private renewal');expect(publicText).not.toContain('Accessibility');expect(publicText).not.toContain('historical-');expect(publicText).not.toContain('Private account')
 for(const comment of ['comment-0','comment-1']){const privateComment=stableFeedbackId(source.namespace,'comments',comment);expect((await call('/api/operator/comments/'+privateComment+'/moderate',{verdict:'approved',publicAuthorDisplayName:'Reviewed speaker'},operator)).status).toBe(409)}
 const originals=await call(importPath+'/jobs/'+job.id+'/originals',undefined,operator)
 expect(originals.headers.get('Cache-Control')).toContain('no-store')
 const retained=await originals.json() as {name:string;original:{base64:string}}[]
 for(const file of source.files)expect(retained.find(r=>r.name===file.name)?.original.base64).toBe(file.base64)
  })()
 }
})

it('[IMP-001][IMP-002] previews classic CSV omissions and retains multiline Unicode originals without invented aggregates',async()=>{
 const operator=await owner(),text=classicCsv+classicCsv.slice(classicCsv.indexOf('\r\n')+2)
 const source:SavedFeedbackInput={namespace:'classic',statuses:{open:'open' as const},boards:[{id:'classic-board',name:'Saved board',isPrivate:false,created:'2024-07-08T09:10:11.000Z'}],files:[{name:'classic.csv',kind:'posts' as const,version:'classic-csv' as const,boardId:'classic-board',tagMapping:{Accessibility:['accessibility']},base64:Buffer.from(text).toString('base64')}]}
 source.files.push({name:'tags.json',kind:'tags',version:'v1',base64:Buffer.from(JSON.stringify({tags:[{id:'accessibility',name:'Accessibility',created:'2024-07-08T09:10:11.000Z'}]})).toString('base64')})
 const plan=await preview(source,operator)
 expect(plan.rows.find(r=>r.kind==='posts')!.omissions.map(o=>o.field).sort()).toEqual(['Associated MRR','Category','Comment Count','Image URLs','Owner','Score (Total Votes)'])
 const job=await apply(source,operator),result=await counts()
 expect(result.tags).toBe(1);expect((await env.DB.prepare('SELECT COUNT(*) n FROM request_tag_assignments').first<{n:number}>())!.n).toBe(1);expect(result.requests).toBe(1);expect(result.request_votes).toBe(0);expect(result.request_comments).toBe(0)
 expect(await env.DB.prepare('SELECT title,description FROM requests').first()).toEqual({title:'Keyboard, labels',description:'Exact quote with café\nSecond line'})
 const originals=await(await call(importPath+'/jobs/'+job.id+'/originals',undefined,operator)).json() as {name:string;original:{base64:string}}[]
 expect(originals.find(r=>r.name==='classic.csv')?.original.base64).toBe(source.files[0].base64)
 const receipt=await(await call(importPath+'/jobs/'+job.id+'/receipt',undefined,operator)).json() as import('@/core/features/imports/receipt').FeedbackReceipt
 expect(receipt.sources.find(row=>row.kind==='posts')).toMatchObject({read:2,eligible:1,applied:1,skipped:[{reason:expect.stringMatching(/duplicate source row/i),count:1}]})
 expect(receipt.aggregates).toEqual([{field:'Score (Total Votes)',category:'count',total:24,rows:2},{field:'Comment Count',category:'count',total:6,rows:2},{field:'Associated MRR',category:'revenue',total:2401,rows:2}])
 expect(receipt.omissions.filter(row=>row.kind==='posts').every(row=>row.count===2)).toBe(true)
 const undo=await call(importPath+'/jobs/'+job.id+'/undo',{},operator);expect(undo.status,await undo.clone().text()).toBe(200);await complete(await undo.json() as typeof job,operator)
 const reversed=await(await call(importPath+'/jobs/'+job.id+'/receipt',undefined,operator)).json() as typeof receipt
 expect(reversed.phase).toBe('undone');expect(reversed.sources).toEqual(receipt.sources);expect(reversed.aggregates).toEqual(receipt.aggregates);expect(reversed.omissions).toEqual(receipt.omissions)
})

it('[IMP-002][BASE-ACCESS-002] refuses invalid, incomplete, unreviewed and unauthorized saved imports before product writes',async()=>{
 const operator=await owner(),source=feedbackFixture(),file=source.files.find(f=>f.kind==='posts')!,body=JSON.parse(Buffer.from(file.base64,'base64').toString())
 body.posts.at(-1).status='unsupported-status';file.base64=Buffer.from(JSON.stringify(body)).toString('base64')
 const plan=await preview(source,operator);expect(plan.counts.rejected).toBe(1)
 expect((await call(importPath+'/apply',{source,fingerprint:plan.fingerprint},operator)).status).toBe(422)
 expect((await env.DB.prepare('SELECT COUNT(*) n FROM ik_jobs').first<{n:number}>())!.n).toBe(0)
 expect((await counts()).requests).toBe(0)
 const valid=feedbackFixture();valid.files.push({name:'empty-users.json',kind:'users',version:'v2',base64:Buffer.from(JSON.stringify({users:[],hasMore:false})).toString('base64')});expect((await call(importPath+'/preview',valid)).status).toBe(401)
 expect((await call(importPath+'/preview',valid,{...operator,Origin:'https://foreign.example.test'})).status).toBe(403)
 const reviewed=await preview(valid,operator)
 expect((await call(importPath+'/apply',{source:valid,fingerprint:reviewed.fingerprint.replace(/^./,reviewed.fingerprint[0]==='a'?'b':'a')},operator)).status).toBe(409)
 expect((await counts()).requests).toBe(0)
 const unsupported=feedbackFixture();unsupported.files[0].version='v2'
 expect((await call(importPath+'/preview',unsupported,operator)).status).toBe(422)
 {
 const source=feedbackFixture(),file=source.files.find(f=>f.kind==='posts')!
 const body=JSON.parse(Buffer.from(file.base64,'base64').toString())
 // The API history summary cannot stand in for the missing complete post.
 body.posts=body.posts.filter((post:{id:string})=>post.id!=='post-2')
 file.base64=Buffer.from(JSON.stringify(body)).toString('base64')
 const unresolved=await preview(source,operator);expect(unresolved.counts.rejected).toBeGreaterThan(0);expect((await call(importPath+'/apply',{source,fingerprint:unresolved.fingerprint},operator)).status).toBe(422)
 const exported=exportFeedbackFixture();delete exported.files.find(f=>f.version==='classic-csv')!.tagMapping
 expect((await call(importPath+'/preview',exported,operator)).status).toBe(409)
 expect((await counts()).requests).toBe(0)
 expect((await env.DB.prepare('SELECT COUNT(*) n FROM ik_jobs').first<{n:number}>())!.n).toBe(0)
 }
})

it('[IMP-006][IMP-007] previews, applies, replays and reverses explicit Ideas mappings and duplicate rows with supplied author each configured input',async()=>{
 for(const suppliedAuthor of [false,true] as const){
  await reset();await applyD1Migrations(env.DB,inject('migrations'))
  await (async()=>{
 const {ideasFeedbackFixture}=await import('./feedback-import-fixture')
 const operator=await owner(),source=ideasFeedbackFixture(),file=source.files[0],created='2024-07-08T09:10:11.000Z'
 const privateCells={title:'Wrong title',details:'Wrong details',status:'wrong-status',created:'invalid raw date',author:'not-a-supplied-requester','Post Title':'Wrong classic title','Post Detail':'Wrong classic details','Post Status':'wrong-classic-status','Post Author':'Wrong classic author','Date created':'invalid classic date',board:'not-the-file-board',tags:'["invented-tag"]',mergeHistory:'[{"post":"invented-post"}]',Owner:'Assigned operator'}
 const cells={'Idea key':'idea-1',Heading:'Chosen title',Body:'Exact café "quote"\r\nSecond line',Stage:'open',When:created,Votes:'40',Comments:'12',Companies:'Acme, Inc.',...(suppliedAuthor?{'Supplied requester':'Explicit historical requester'}:{}),...privateCells}
 const csvRow=(values:string[])=>values.map(value=>'"'+value.replaceAll('"','""')+'"').join(','),row=csvRow(Object.values(cells))
 file.ideas={key:'Idea key',title:'Heading',details:'Body',status:'Stage',created:'When',...(suppliedAuthor?{author:'Supplied requester'}:{}),aggregates:{Votes:'count',Comments:'count',Companies:'company'},omissions:Object.keys(privateCells)}
 file.base64=Buffer.from('\uFEFF'+csvRow(Object.keys(cells))+'\r\n'+row+'\r\n'+row+'\r\n').toString('base64')
 const response=await call(importPath+'/preview',source,operator)
 expect(response.status,await response.clone().text()).toBe(200)
 const planned=await response.json() as {receipt:import('@/core/features/imports/receipt').FeedbackReceipt}
 expect(planned.receipt.sources.find(row=>row.kind==='posts')).toMatchObject({read:2,eligible:1,applied:0,skipped:[{reason:expect.stringMatching(/duplicate source row/i),count:1}]})
 expect(planned.receipt.aggregates).toEqual([{field:'Votes',category:'count',total:80,rows:2},{field:'Comments',category:'count',total:24,rows:2},{field:'Companies',category:'company',total:null,rows:2}])
 for(const field of Object.keys(privateCells))expect(planned.receipt.omissions.find(row=>row.kind==='posts'&&row.field===field)).toMatchObject({count:2})
 expect(planned.receipt.unresolved).toEqual([])
 const job=await apply(source,operator),before=await counts()
 const author=suppliedAuthor?stableFeedbackId(source.namespace,'users','csv-author:idea-1'):null
 expect(await env.DB.prepare('SELECT id,board_id,title,description,author_requester_id,moderation_state,public_state,created_at FROM requests').first()).toEqual({id:stableFeedbackId(source.namespace,'posts','idea-1'),board_id:stableFeedbackId(source.namespace,'boards','ideas-board'),title:'Chosen title',description:'Exact café "quote"\r\nSecond line',author_requester_id:author,moderation_state:'awaiting_review',public_state:'open',created_at:created})
 expect(await env.DB.prepare('SELECT requester_id,observed_at FROM evidence_items').first()).toEqual({requester_id:author,observed_at:created})
 expect(await env.DB.prepare('SELECT wording FROM evidence_versions').first('wording')).toBe('Exact café "quote"\r\nSecond line')
 expect(await env.DB.prepare('SELECT id,display_name,created_at FROM requesters').all().then(result=>result.results)).toEqual(suppliedAuthor?[{id:author,display_name:'Explicit historical requester',created_at:created}]:[])
 expect(await env.DB.prepare('SELECT COUNT(*) FROM request_content_submissions').first('COUNT(*)')).toBe(Number(suppliedAuthor))
 for(const table of ['request_votes','request_vote_contributions','request_comments','request_follows','accounts','notification_outbox','notification_intents','custom_field_values','requester_account_links','request_follow_contributions','request_merges','tags','request_tag_assignments','requester_addresses','requester_update_permissions','native_requester_sessions'])expect(await env.DB.prepare('SELECT COUNT(*) FROM '+table).first('COUNT(*)')).toBe(0)
 const receipt=await(await call(importPath+'/jobs/'+job.id+'/receipt',undefined,operator)).json() as typeof planned.receipt
 expect(receipt.effects).toEqual({mail:0,notifications:0})
 expect(receipt.sources.find(row=>row.kind==='posts')).toEqual({...planned.receipt.sources.find(row=>row.kind==='posts'),applied:1});expect(receipt.aggregates).toEqual(planned.receipt.aggregates);expect(receipt.omissions).toEqual(planned.receipt.omissions)
 for(const table of ['requests','evidence_items'])expect(receipt.destinations.find(row=>row.table===table)).toMatchObject({planned:1,created:1,retained:1})
 for(const entry of receipt.destinations)expect(await env.DB.prepare('SELECT COUNT(*) FROM '+entry.table).first('COUNT(*)')).toBe(entry.created)
 expect((await apply(source,operator)).id).toBe(job.id);expect(await counts()).toEqual(before)
 const changed=structuredClone(source);changed.files[0].base64=Buffer.from(Buffer.from(changed.files[0].base64,'base64').toString().replaceAll('Second line','Changed line')).toString('base64')
 const changedPreview=await preview(changed,operator);expect(changedPreview.counts.rejected).toBeGreaterThan(0)
 expect((await call(importPath+'/apply',{source:changed,fingerprint:changedPreview.fingerprint},operator)).status).toBe(422);expect(await counts()).toEqual(before)
 const originals=await(await call(importPath+'/jobs/'+job.id+'/originals',undefined,operator)).json() as {name:string;original:{base64:string}}[]
 expect(originals.find(row=>row.name==='ideas.csv')?.original.base64).toBe(source.files[0].base64)
 const undo=await call(importPath+'/jobs/'+job.id+'/undo',{},operator);expect(undo.status,await undo.clone().text()).toBe(200);await complete(await undo.json() as typeof job,operator)
 const reversed=await(await call(importPath+'/jobs/'+job.id+'/receipt',undefined,operator)).json() as typeof receipt
 expect(reversed.phase).toBe('undone');expect(reversed.destinations.every(row=>row.created===row.removed)).toBe(true)
 expect(reversed.sources).toEqual(receipt.sources);expect(reversed.aggregates).toEqual(receipt.aggregates);expect(reversed.omissions).toEqual(receipt.omissions)
 const reapplied=await apply(source,operator);expect(reapplied.id).not.toBe(job.id);expect(await counts()).toEqual(before)
  })()
 }
})
it('[IMP-002][IMP-006] refuses unknown and missing Ideas headings by name and lists all unresolved relationships',async()=>{
 const {ideasFeedbackFixture}=await import('./feedback-import-fixture'),operator=await owner()
 for(const missing of [false,true]){const source=ideasFeedbackFixture();if(missing)source.files[0].ideas!.title='Missing title';else source.files[0].ideas!.aggregates={Votes:'count',Comments:'count'}
 const response=await call(importPath+'/preview',source,operator);expect(response.status).toBe(422);const refusal=await response.json() as {message:string;omissions:string[]};expect(refusal.message).toContain(missing?'Missing title':'Companies');expect(refusal.omissions).toContain(missing?'Missing title':'Companies')}
 const source=feedbackFixture(),file=source.files.find(file=>file.kind==='posts')!,payload=JSON.parse(Buffer.from(file.base64,'base64').toString());payload.posts[0].board='missing-board';payload.posts[0].tags=['missing-tag'];file.base64=Buffer.from(JSON.stringify(payload)).toString('base64')
 const response=await call(importPath+'/preview',source,operator);expect(response.status,await response.clone().text()).toBe(200)
 const result=await response.json() as {fingerprint:string;receipt:import('@/core/features/imports/receipt').FeedbackReceipt}
 expect(result.receipt.unresolved).toEqual(expect.arrayContaining([{kind:'posts',sourceId:'post-0',field:'board',target:'missing-board'},{kind:'posts',sourceId:'post-0',field:'tags',target:'missing-tag'}]))
 expect((await call(importPath+'/apply',{source,fingerprint:result.fingerprint},operator)).status).toBe(422)
 expect((await counts()).requests).toBe(0)
})
it('[IMP-003][IMP-007] resumes bounded saved history by job ID and preserves stream originals and receipts through undo',async()=>{
 const {boundedFeedbackFixture}=await import('./feedback-import-fixture');const operator=await owner(),source=boundedFeedbackFixture()
 const reviewed=await preview(source,operator),start=await call(importPath+'/apply',{source,fingerprint:reviewed.fingerprint},operator)
 expect(start.status,await start.clone().text()).toBe(202)
 let job=await start.json() as {id:string;state:string;checkpoint:number}
 for(let i=0;i<100&&job.state!=='completed';i++){const response=await call(importPath+'/jobs/'+job.id+'/resume',{},operator);expect(response.status,await response.clone().text()).toBe(200);job=await response.json() as typeof job}
 expect(job.state).toBe('completed');expect(await env.DB.prepare('SELECT COUNT(*) n FROM requesters').first('n')).toBe(200);expect(await env.DB.prepare('SELECT COUNT(*) n FROM requests').first('n')).toBe(100);expect(await env.DB.prepare('SELECT COUNT(*) n FROM request_vote_contributions').first('n')).toBe(1400);expect(await env.DB.prepare('SELECT COUNT(*) n FROM request_comments').first('n')).toBe(300)
 const repeat=await call(importPath+'/apply',{source,fingerprint:reviewed.fingerprint},operator);expect(repeat.status,await repeat.clone().text()).toBe(200);expect((await repeat.json() as {id:string}).id).toBe(job.id)
 const originals=await(await call(importPath+'/jobs/'+job.id+'/originals',undefined,operator)).json() as {name:string;original:{base64:string}}[];expect(originals.find(row=>row.name==='ideas.csv')?.original.base64).toBe(source.files[0].base64)
 const receipt=await(await call(importPath+'/jobs/'+job.id+'/receipt',undefined,operator)).json() as import('@/core/features/imports/receipt').FeedbackReceipt;expect(receipt.sources.find(row=>row.kind==='users')?.applied).toBe(200)
 const beforeUndo=await counts()
 let reversed=await call(importPath+'/jobs/'+job.id+'/undo',{},operator);expect(reversed.status,await reversed.clone().text()).toBe(200);job=await reversed.json() as typeof job
 expect(job.state).toBe('preflighting');expect(await counts()).toEqual(beforeUndo);const sameJob=job.id
 const saved=await(await call(importPath+'/jobs/'+job.id,undefined,operator)).json() as typeof job;expect(saved.state).toBe('preflighting');expect(saved.id).toBe(sameJob)
 for(let i=0;i<100&&job.state!=='undone';i++){reversed=await call(importPath+'/jobs/'+job.id+'/resume',{},operator);expect(reversed.status,await reversed.clone().text()).toBe(200);job=await reversed.json() as typeof job}
 expect(job.id).toBe(sameJob);expect(job.state).toBe('undone');expect(Object.values(await counts()).every(count=>count===0)).toBe(true)
},60000)
