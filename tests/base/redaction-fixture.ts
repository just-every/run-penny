import {expect,inject} from 'vitest'
import {reset,applyD1Migrations} from 'cloudflare:test'
import {env} from 'cloudflare:workers'
import {runRedactionQueue} from '@/core/features/redaction/background'
import {createMessageBatch} from 'cloudflare:test'
import {prepareRedactionCopies} from './redaction-copy-doors'
import {redactionImportDoors} from './redaction-import-door'
import {proveLearningRedaction} from './redaction-learning-door'
import {incomingEmail} from './email-capture-fixture'
import {providerMessages} from './provider-messages'
import type {Archive,ErasureJournal} from '@/core/features/data/archive'
type Call=(path:string,body?:unknown,headers?:Record<string,string>,method?:string)=>Response|Promise<Response>
export async function proveRedaction(call:Call,fixture:()=>Promise<{operator:Record<string,string>}>,person:()=>Promise<Record<string,string>>){
 await reset();const migrations=inject('migrations') as {name:string;queries:string[]}[]
 await applyD1Migrations(env.DB,migrations.filter(row=>Number(row.name.slice(0,4))<95))
 await env.DB.batch([env.DB.prepare("INSERT INTO evidence_items(id,source_type,source_label,observed_at,review_state,created_at,updated_at) VALUES('synthetic-penny-prior','free_text','Synthetic prior capture','2026-10-01','unreviewed','2026-10-01','2026-10-01')"),env.DB.prepare("INSERT INTO evidence_versions(id,evidence_id,version_number,wording,created_at,updated_at) VALUES('synthetic-penny-prior-version','synthetic-penny-prior',1,'Prior evidence survives upgrade','2026-10-01','2026-10-01')")])
 const old=(await env.DB.prepare('SELECT * FROM evidence_versions').all()).results
 await applyD1Migrations(env.DB,migrations);await applyD1Migrations(env.DB,migrations)
 expect((await env.DB.prepare('SELECT * FROM evidence_versions').all()).results).toEqual(old)
 const g=await fixture(),read=async<T>(response:Response|Promise<Response>,status=200):Promise<T>=>{const r=await response;expect(r.status,await r.clone().text()).toBe(status);return r.json() as Promise<T>}
 const rules={enabled:true,kinds:['ssn','card','phone','email','credential'],patterns:[] as string[]}
 expect(await read(call('/api/operator/settings/redaction',undefined,g.operator))).toMatchObject({enabled:false})
 await read(call('/api/operator/settings/redaction',rules,g.operator,'PUT'))
 const before=(await env.DB.prepare('SELECT * FROM penny_redaction_settings').all()).results
 expect((await call('/api/operator/settings/redaction',{...rules,patterns:['(a+)+$']},g.operator,'PUT')).status).toBe(422)
 expect((await env.DB.prepare('SELECT * FROM penny_redaction_settings').all()).results).toEqual(before)
 const ssn='234-56-7890',card='4111 1111 1111 1111',wording=`Synthetic Penny ticket: SSN ${ssn}; card ${card}; ACCOUNT-1234.`
 const capture=(text:string)=>read<{id:string}>(call('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Synthetic capture ACCOUNT-1234',wording:text,observedAt:'2026-10-22T09:00:00Z'},g.operator),201)
 const item=await capture(wording)
 const stored=await env.DB.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(item.id).first<string>('wording')
 expect(stored).toContain('[REDACTED:ssn]');expect(stored).toContain('[REDACTED:card]');expect(stored).not.toContain(ssn);expect(stored).not.toContain(card)
 await read(call('/api/operator/settings/email-capture',{captureAddress:'capture@penny.test',domains:['example.test']},g.operator,'PUT'))
 await incomingEmail({id:'<synthetic-penny-redaction@example.test>',body:wording})
 const email=await env.DB.prepare("SELECT v.wording FROM evidence_versions v JOIN evidence_items e ON e.id=v.evidence_id WHERE e.source_type='email'").first<string>('wording')
 expect(email).toBe(stored)
 const requester=await person()
 await read(call('/api/public/requests',{title:'Synthetic portal capture',description:wording,boardSlug:'feedback',idempotencyKey:'synthetic-penny-redaction-submission',emailUpdates:false},requester),201)
 expect(await env.DB.prepare("SELECT description FROM requests WHERE title='Synthetic portal capture'").first('description')).toBe(stored)
 const secretSearch=await read<{items:unknown[]}>(call('/api/operator/search?q='+encodeURIComponent(ssn),undefined,g.operator));expect(secretSearch.items).toEqual([])
 const search=await read<{items:unknown[]}>(call('/api/operator/search?q='+encodeURIComponent('Synthetic Penny ticket'),undefined,g.operator));expect(search.items.length).toBeGreaterThan(0);expect(JSON.stringify(search)).toContain('[REDACTED:ssn]');expect(JSON.stringify(search)).not.toContain(card)
 const copyTables=await prepareRedactionCopies(call,g.operator,requester)
 // More than 200 stored rows, across wording versions and request copies.
 for(let index=0;index<105;index++){
  await capture(`Synthetic prior excerpt ${index} ACCOUNT-1234`)
  await read(call('/api/operator/requests',{title:`Synthetic copied request ${index}`,description:'Copied prior excerpt ACCOUNT-1234',boardSlug:'feedback',evidenceIds:[]},g.operator),201)
 }
 // A real invited non-owner is refused independently of requester admission.
 const peerEmail='synthetic-penny-redaction-peer@example.test'
 await read(call('/api/operator/settings/operators',{email:peerEmail},g.operator),202)
 const peerMail=(await providerMessages().list()).find(row=>row.message.to.includes(peerEmail))!,peerToken=new URL(peerMail.message.text!.match(/https?:\/\/\S+/)![0]).searchParams.get('token')
 const peerResponse=await call('/auth/confirm',{token:peerToken});expect(peerResponse.status).toBe(303)
 const peer={Cookie:peerResponse.headers.get('set-cookie')!.split(';')[0]}
 expect((await call('/api/operator/settings/redaction/preview',{},peer)).status).toBe(403)
 rules.patterns=['ACCOUNT-[0-9]{4}','synthetic-penny-rule@example.test']
 await read(call('/api/operator/settings/redaction',rules,g.operator,'PUT'))
 const newer=await capture('New capture ACCOUNT-5678')
 expect(await env.DB.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(newer.id).first('wording')).toBe('New capture [REDACTED:custom]')
 expect(await env.DB.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(item.id).first('wording')).toContain('ACCOUNT-1234')
 expect((await call('/api/operator/settings/redaction/preview',{},requester)).status).toBe(401)
 type Run={id:string;state:string;records:number;changes:number;changed:number;scanned:number;planHash:string;places:{table:string;records:number;changes:number|null;blocked:boolean}[]}
 const tick=()=>runRedactionQueue(createMessageBatch('penny-redaction',[{id:crypto.randomUUID(),timestamp:Date.now(),attempts:1,body:{kind:'redaction.advance'}}]),env)
 const status=(id:string)=>read<Run>(call('/api/operator/settings/redaction/runs/'+id,undefined,g.operator))
 const settle=async(run:Run,target:string)=>{for(let page=0;run.state!==target&&run.state!=='failed'&&page<80;page++){await tick();run=await status(run.id)}expect(run.state).toBe(target);return run}
 const makePreview=async()=>settle(await read<Run>(call('/api/operator/settings/redaction/preview',{},g.operator),202),'ready')
 const stale=await makePreview()
 await capture('A capture arriving after preview ACCOUNT-9012')
 expect((await call('/api/operator/settings/redaction/reapply',{planHash:stale.planHash,confirmIrreversible:true},g.operator)).status).toBe(409)
 const preview=await makePreview()
 expect(preview.records).toBeGreaterThan(200);expect(preview.changes).toBeGreaterThan(200)
 for(const table of copyTables)expect(preview.places.find(p=>p.table===table)?.changes).toBeGreaterThan(0)
 expect(preview.places.find(p=>p.table==='decisions')).toMatchObject({blocked:true,changes:null})
 expect((await call('/api/operator/settings/redaction/reapply',{planHash:preview.planHash,confirmIrreversible:true},peer)).status).toBe(403)
 expect((await call('/api/operator/settings/redaction/reapply',{planHash:preview.planHash},g.operator)).status).toBe(400)
 const effectTables=['notification_events','notification_outbox','notification_intents','penny_integration_events','integration_deliveries','request_vote_contributions']
 const effects=async()=>Promise.all(effectTables.map(table=>env.DB.prepare('SELECT count(*) n FROM '+table).first('n')))
 const beforeEffects=await effects(),beforeMessages=(await providerMessages().list()).length
 const running=await read<Run>(call('/api/operator/settings/redaction/reapply',{planHash:preview.planHash,confirmIrreversible:true},g.operator),202)
 expect(running.state).toBe('running')
 await tick()
 const interrupted=await status(running.id);expect(interrupted.state).toBe('running');expect(interrupted.changed).toBeGreaterThan(0);expect(interrupted.changed).toBeLessThan(preview.changes)
 // No tab/worker holds a page open. Another invocation resumes the committed cursor.
 const resumed=await read<Run>(call('/api/operator/settings/redaction/runs/'+running.id+'/resume',{},g.operator),202)
 const applied=await settle(resumed,'complete');expect(applied.changed).toBe(preview.changes)
 expect(await effects()).toEqual(beforeEffects);expect((await providerMessages().list()).length).toBe(beforeMessages)
 const copies=(await env.DB.batch(copyTables.map(table=>env.DB.prepare('SELECT * FROM '+table)))).map(r=>r.results)
 expect(JSON.stringify(copies)).not.toContain('ACCOUNT-1234');expect(JSON.stringify(copies)).toContain('[REDACTED:custom]')
 expect(await env.DB.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(item.id).first('wording')).toContain('[REDACTED:custom]')
 await tick();expect((await status(running.id)).changed).toBe(applied.changed)
 const again=await makePreview();expect(again.changes).toBe(0)
 const second=await settle(await read<Run>(call('/api/operator/settings/redaction/reapply',{planHash:again.planHash,confirmIrreversible:true},g.operator),202),'complete');expect(second.changed).toBe(0)
 expect(await env.DB.prepare("SELECT count(*) n FROM audit_entries WHERE action='redaction.reapplied'").first('n')).toBe(2)
 expect(JSON.parse((await env.DB.prepare("SELECT details_json FROM audit_entries WHERE action='redaction.reapplied' AND entity_id=?").bind(running.id).first<string>('details_json'))!)).toMatchObject({changed:preview.changes})
 // A policy change stops confirmed work visibly; another delivery cannot
 // restart it or apply a stale page. A fresh preview is required.
 const failurePlan=await makePreview()
 const willFail=await read<Run>(call('/api/operator/settings/redaction/reapply',{planHash:failurePlan.planHash,confirmIrreversible:true},g.operator),202)
 await read(call('/api/operator/settings/redaction',{...rules,enabled:false},g.operator,'PUT'))
 await tick()
 expect(await status(willFail.id)).toMatchObject({state:'failed',changed:0,error:'redaction_rules_changed'})
 expect(await read(call('/api/operator/settings/redaction',undefined,g.operator))).toMatchObject({latestRun:{id:willFail.id,state:'failed'}})
 expect((await call('/api/operator/settings/redaction/runs/'+willFail.id+'/resume',{},g.operator)).status).toBe(409)
 expect((await call('/api/operator/settings/redaction/runs/'+willFail.id,undefined,peer)).status).toBe(403)
 await tick();expect(await env.DB.prepare("SELECT count(*) n FROM audit_entries WHERE action='redaction.failed' AND entity_id=?").bind(willFail.id).first('n')).toBe(1)
 await read(call('/api/operator/settings/redaction',rules,g.operator,'PUT'))
 const ruleEmail='synthetic-penny-rule@example.test'
 await read(call('/api/public/identity/email',{email:ruleEmail,displayName:'Synthetic rule subject'}),202)
 const sent=(await providerMessages().list()).find(row=>row.message.to.includes(ruleEmail))!,token=new URL(sent.message.text!.match(/https?:\/\/\S+/)![0]).hash.slice(7)
 await read(call('/api/public/identity/email/verify',{token}))
 const portable=await read<{archive:Archive;journal:ErasureJournal}>(call('/api/operator/data/export',undefined,g.operator))
 for(const value of [ssn,card])expect(JSON.stringify(portable)).not.toContain(value)
 expect(portable.archive.tables.penny_redaction_settings).toHaveLength(1)
 await reset();await applyD1Migrations(env.DB,migrations)
 const boot=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner'});expect(boot.status).toBe(303)
 const destination={Cookie:boot.headers.get('set-cookie')!.split(';')[0]}
 const complete=async(path:string,body:unknown)=>{let response=await call(path,body,destination);expect([200,202],await response.clone().text()).toContain(response.status);let result=await response.json() as {status:string;operationId:string};for(let step=0;result.status!=='complete'&&step<50;step++){response=await call(`/api/operator/data/operations/${result.operationId}/resume`,{},destination);expect([200,202],await response.clone().text()).toContain(response.status);result=await response.json() as typeof result}expect(result.status).toBe('complete')}
 await complete('/api/operator/data/import',portable)
 expect(await env.DB.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(item.id).first('wording')).toContain('[REDACTED:ssn]')
 const restored=await read(call('/api/operator/search?q='+encodeURIComponent('Synthetic Penny ticket'),undefined,destination));expect(JSON.stringify(restored)).not.toContain(ssn);expect(JSON.stringify(restored)).toContain('[REDACTED:card]')
 const id=await env.DB.prepare('SELECT requester_id FROM requester_addresses WHERE email=?').bind(ruleEmail).first('requester_id')
 const erasure=await read<{planHash:string;blockedCopies:unknown[]}>(call('/api/operator/data/erasure/preview',{table:'requesters',id},destination));expect(erasure.blockedCopies).toEqual([])
 await complete('/api/operator/data/erasure',{table:'requesters',id,planHash:erasure.planHash})
 expect(JSON.stringify(await read(call('/api/operator/data/export',undefined,destination)))).not.toContain(ruleEmail)
 expect(await env.DB.prepare('SELECT patterns_json FROM penny_redaction_settings').first('patterns_json')).toBe(JSON.stringify(['ACCOUNT-[0-9]{4}']))
}

/** One storage behavior across every implemented capture door. Provider and
 * source fixtures stop at the network edge; every product write uses a route. */
export async function proveCapturedRedaction(call:Call,fixture:()=>Promise<{operator:Record<string,string>}>,person:()=>Promise<Record<string,string>>){
 const g=await fixture(),read=async<T>(response:Response|Promise<Response>,status=200):Promise<T>=>{const r=await response;expect(r.status,await r.clone().text()).toBe(status);return r.json() as Promise<T>}
 await read(call('/api/operator/settings/redaction',{enabled:true,kinds:['ssn','card','phone','email','credential'],patterns:[]},g.operator,'PUT'))
 const ssn='234-56-7890',card='4111 1111 1111 1111',wording=`Synthetic Penny ticket: SSN ${ssn}; card ${card}.`
 const doors:{kind:string;evidenceId:string;requestId?:string}[]=[]
 const operator=await read<{id:string}>(call('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Synthetic operator redaction door',wording,observedAt:'2026-10-24T09:00:00Z'},g.operator),201);doors.push({kind:'operator',evidenceId:operator.id})
 await read(call('/api/operator/settings/email-capture',{captureAddress:'capture@penny.test',domains:['example.test']},g.operator,'PUT'))
 await incomingEmail({id:'<synthetic-penny-all-redaction@example.test>',body:wording})
 const email=await env.DB.prepare("SELECT id FROM evidence_items WHERE source_type='email'").first<string>('id');expect(email).toBeTruthy();doors.push({kind:'CAP-009',evidenceId:email!})
 await read(call('/api/public/requests',{title:'Synthetic portal redaction door',description:wording,boardSlug:'feedback',idempotencyKey:'synthetic-penny-all-redaction',emailUpdates:false},await person()),201)
 const portal=await env.DB.prepare("SELECT r.id requestId,l.evidence_id evidenceId FROM requests r JOIN request_evidence_links l ON l.request_id=r.id WHERE r.title='Synthetic portal redaction door'").first<{requestId:string;evidenceId:string}>();doors.push({kind:'portal',...portal!})
 const importDoors=await redactionImportDoors(call,g.operator,wording);doors.push(...importDoors)
 await proveLearningRedaction(call,g.operator,wording)
 const learningEvidence=await env.DB.prepare("SELECT id FROM evidence_items WHERE source_label='Learning redaction native input'").first<string>('id');doors.push({kind:'Orbit/native learning',evidenceId:learningEvidence!})
 for(const door of doors){
  const version=await read(call('/api/operator/evidence/'+door.evidenceId+'/versions',undefined,g.operator))
  const stored=JSON.stringify(version);expect(stored,door.kind).toContain('[REDACTED:ssn]');expect(stored,door.kind).toContain('[REDACTED:card]');expect(stored,door.kind).not.toContain(ssn);expect(stored,door.kind).not.toContain(card)
  if(door.requestId){const row=await env.DB.prepare('SELECT title,description FROM requests WHERE id=?').bind(door.requestId).first();expect(JSON.stringify(row),door.kind).toContain('[REDACTED:ssn]');expect(JSON.stringify(row),door.kind).not.toContain(card)}
 }
 const search=await read<{items:unknown[]}>(call('/api/operator/search?q='+encodeURIComponent('Synthetic Penny ticket'),undefined,g.operator));expect(search.items.length).toBeGreaterThan(0);expect(JSON.stringify(search)).toContain('[REDACTED:ssn]');expect(JSON.stringify(search)).toContain('[REDACTED:card]')
 const archive=await read(call('/api/operator/data/export',undefined,g.operator))
 for(const value of [ssn,card]){expect(JSON.stringify(search)).not.toContain(value);expect(JSON.stringify(archive)).not.toContain(value);expect(await read(call('/api/operator/search?q='+encodeURIComponent(value),undefined,g.operator))).toMatchObject({items:[]})}
 expect(JSON.stringify(archive)).toContain('[REDACTED:ssn]');expect(JSON.stringify(archive)).toContain('[REDACTED:card]')
 await read(call('/api/operator/settings/redaction',{enabled:true,kinds:['ssn','card','phone','email','credential'],patterns:['ACCOUNT-[0-9]{4}']},g.operator,'PUT'))
 const imported=importDoors[0]
 expect((await call('/api/operator/feedback-import/jobs/'+imported.jobId+'/resume',{},g.operator)).status).toBe(409)
 expect((await call('/api/operator/feedback-import/apply',{source:imported.source,fingerprint:imported.fingerprint},g.operator)).status).toBe(409)
 let undone=await read<{id:string;state:string}>(call('/api/operator/feedback-import/jobs/'+imported.jobId+'/undo',{},g.operator))
 for(let step=0;undone.state!=='undone'&&step<80;step++)undone=await read(call('/api/operator/feedback-import/jobs/'+undone.id+'/resume',{},g.operator))
 expect(undone.state).toBe('undone')
 const starting=await read<{id:string;state:string}>(call('/api/operator/settings/redaction/preview',{},g.operator),202)
 let planned=await read<{state:string;places:{table:string;records:number;blocked:boolean}[]}>(call('/api/operator/settings/redaction/runs/'+starting.id,undefined,g.operator))
 for(let page=0;planned.state==='previewing'&&page<40;page++){await runRedactionQueue(createMessageBatch('penny-redaction',[{id:crypto.randomUUID(),timestamp:Date.now(),attempts:1,body:{kind:'redaction.advance'}}]),env);planned=await read(call('/api/operator/settings/redaction/runs/'+starting.id,undefined,g.operator))}
 expect(planned.state).toBe('ready')
 for(const table of ['evidence_versions:import-owned','requests:import-owned','learning_observations','learning_artifacts','learning_commitments'])expect(planned.places.find(p=>p.table===table)).toMatchObject({blocked:true,records:expect.any(Number)})
 expect(planned.places.find(p=>p.table==='evidence_versions:import-owned')!.records).toBeGreaterThan(0)
}
