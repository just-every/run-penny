import {expect,inject,it,vi} from 'vitest'
import {env} from 'cloudflare:workers'
import {applyD1Migrations,reset} from 'cloudflare:test'
import {base64urlEncode,sign} from '@/core/features/auth/tokens'
import {hash,type exportArchive} from '@/core/features/data/archive'
import {call,json,fixture,path,bindings,sent} from './learning-test-runtime'
import {mockMail,messages} from './support'

type Review={id:string;investigationId:string;interpretationId:string;interpretationVersion:number;optionId:string;decision:string;reason:string;actorId:string;createdAt:string}
type Detail={investigation:Record<string,unknown>;artifacts:{id:string;version:number;body:Record<string,unknown>}[];observations:Record<string,unknown>[];commitments:Record<string,unknown>[];optionReviews:Review[]}
const retainedTables=['learning_investigations','learning_artifacts','learning_observations','learning_contributions','learning_commitments','learning_corrections','learning_option_reviews','evidence_items','evidence_versions','requests','request_content_submissions','request_vote_contributions','requester_update_permissions','decisions','decision_revisions','candidate_bets','notification_intents','notification_outbox','penny_integration_guards','requester_write_guards']
const custody=async()=> (await env.DB.batch(retainedTables.map(table=>env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`)))).map(result=>result.results)

it('rejects an explanation with attributed history while retaining originals and commitment custody through restore and erasure',async()=>{
 const f=await fixture({nativeOnly:true}),custom=bindings()
 delete custom.PENNY_LEARNING
 // Invite through native management, then restore the mail edge before the
 // learning journey: only the existing model HTTP edge is faked below.
 const peerEmail=['synthetic-penny-reviewer','example.test'].join('@')
 let peer=''
 mockMail()
 try{
  await json(call('/api/operator/settings/operators',{email:peerEmail},f.cookie,custom),202)
  const message=messages.findLast(message=>message.to===peerEmail)!
  const confirmed=await call('/auth/confirm',{token:new URL(message.url).searchParams.get('token')},'',custom)
  expect(confirmed.status).toBe(303)
  peer=confirmed.headers.get('set-cookie')!.split(';')[0]
 }finally{vi.restoreAllMocks()}
 await json(call(path,undefined,peer,custom))
 const actorId=(await env.DB.prepare('SELECT id FROM operators WHERE email=?').bind(peerEmail).first<string>('id'))!
 const nativePeerId=(await env.DB.prepare('SELECT id FROM oa_operators WHERE email=?').bind(peerEmail).first<string>('id'))!
 expect(actorId).toBeTruthy()
 expect(nativePeerId).toBeTruthy()
 expect(actorId).not.toBe(await env.DB.prepare('SELECT actor_id FROM learning_investigations WHERE id=?').bind(f.investigation.id).first('actor_id'))
 custom.PORTAL_IDENTITY_SECRET='synthetic-penny-host-signing-material'
 const claim=base64urlEncode(new TextEncoder().encode(JSON.stringify({aud:'https://penny.test',issuedAt:new Date().toISOString(),email:['synthetic-penny-1','example.test'].join('@'),displayName:'Synthetic Penny person'})))
 const identity={'X-Penny-Identity':claim,'X-Penny-Identity-Signature':base64urlEncode(await sign(custom.PORTAL_IDENTITY_SECRET,claim))}
 await json(call('/api/public/identity/host',{},'',custom,'POST',identity))
 const requesterId=(await env.DB.prepare('SELECT id FROM requesters').first<string>('id'))!
 await json(call('/api/operator/boards',{name:'Native feedback',slug:'native-feedback',visibility:'public'},f.cookie,custom),201)
 const request=await json<{slug:string}>(call('/api/public/requests',{title:'Explain the report handoff',description:'The existing report needs a clearer handoff.',boardSlug:'native-feedback',idempotencyKey:crypto.randomUUID()},'',custom,'POST',identity),201)
 const requestId=(await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(request.slug).first<string>('id'))!
 const investigation=await json<{id:string}>(call(path+'/investigations',{question:'What explains the handoff problem?',nativeEvidenceIds:[f.evidence.id],nativeRequestIds:[requestId],purpose:'Compare the selected native originals without acting on a customer',expiresAt:'2099-01-01T00:00:00Z',budgetMicros:1000000,maxRunCostMicros:100000,intervalMinutes:60},f.cookie,custom),201)
 const url=path+`/investigations/${investigation.id}`
 const detail=(cookie=f.cookie)=>json<Detail>(call(url,undefined,cookie,custom))
 const run=await json<{artifactId:string}>(call(url+'/run',{},f.cookie,custom))
 await json(call(url+'/commit',{interpretationId:run.artifactId,optionId:'assist',rationale:'Keep the accountable choice separate from explanation review',confidence:'low',reviewAt:'2098-01-01T00:00:00Z'},f.cookie,custom),201)
 const active=await detail(),pausedInput={interpretationId:run.artifactId,interpretationVersion:active.artifacts[0].version,optionId:'build',reason:'Review the explanation only under a current grant.'}
 await json(call(url+'/control',{action:'pause'},f.cookie,custom))
 const paused=await detail(),pausedCustody=await custody(),pausedCalls=sent.length
 expect(await json(call(url+'/reject',pausedInput,peer,custom),409)).toMatchObject({error:'learning_scope_changed'})
 expect(await custody()).toEqual(pausedCustody)
 expect(await detail()).toEqual(paused)
 expect(sent).toHaveLength(pausedCalls)
 await json(call(url+'/control',{action:'resume'},f.cookie,custom))
 const resumed=await detail()
 expect({...resumed,investigation:active.investigation}).toEqual(active)
 const before=await detail(),artifact=before.artifacts.find(a=>a.id===run.artifactId)!
 expect(before.observations).toHaveLength(2)
 expect(before.commitments).toHaveLength(1)
 expect(before.optionReviews).toEqual([])
 const input={interpretationId:artifact.id,interpretationVersion:artifact.version,optionId:'build',reason:'The existing report already meets the need; the handoff explanation is stronger.'}
 const modelCalls=sent.length,started=Date.now(),beforeCustody=await custody()
 const rejected=await json<{id:string}>(call(url+'/reject',input,peer,custom),201)
 const after=await detail(),review=after.optionReviews[0]
 expect(review).toEqual({id:rejected.id,investigationId:investigation.id,interpretationId:artifact.id,interpretationVersion:artifact.version,optionId:'build',decision:'rejected',reason:input.reason,actorId,createdAt:expect.any(String)})
 expect(Date.parse(review.createdAt)).toBeGreaterThanOrEqual(started)
 expect(Date.parse(review.createdAt)).toBeLessThanOrEqual(Date.now())
 expect({...after,optionReviews:[]}).toEqual(before)
 expect((await custody()).filter((_,i)=>retainedTables[i]!=='learning_option_reviews')).toEqual(beforeCustody.filter((_,i)=>retainedTables[i]!=='learning_option_reviews'))
 expect(await detail()).toEqual(after)
 const audit=(await env.DB.prepare("SELECT actor_type,actor_id,entity_id,details_json FROM audit_entries WHERE action='learning.option_rejected'").first<{actor_type:string;actor_id:string;entity_id:string;details_json:string}>())!
 expect({...audit,details_json:JSON.parse(audit.details_json)}).toEqual({actor_type:'operator',actor_id:actorId,entity_id:investigation.id,details_json:{reviewId:review.id,interpretationId:artifact.id,interpretationVersion:artifact.version,optionId:'build'}})
 // Refusals must leave the same original graph, reviews and commitment records.
 const refuse=async(body:unknown,status:number,error:string,target=url,cookie=f.cookie,headers:Record<string,string>={})=>{
  const prior=await custody(),audits=await env.DB.prepare("SELECT count(*) n FROM audit_entries WHERE action='learning.option_rejected'").first('n')
  expect(await json(call(target+'/reject',body,cookie,custom,'POST',headers),status)).toMatchObject({error})
  expect(await custody()).toEqual(prior)
  expect(await env.DB.prepare("SELECT count(*) n FROM audit_entries WHERE action='learning.option_rejected'").first('n')).toBe(audits)
 }
 await refuse(input,409,'learning_option_already_rejected')
 await refuse({...input,interpretationVersion:artifact.version+1},409,'learning_interpretation_stale')
 await refuse({...input,optionId:'synthetic-penny-unknown'},409,'learning_option_unknown')
 await refuse(input,409,'learning_interpretation_stale',path+`/investigations/${f.investigation.id}`)
 await refuse({...input,reason:'  '},400,'validation_failed')
 await refuse({...input,actorId:'synthetic-penny-forged'},400,'validation_failed')
 await refuse({...input,optionId:'assist'},401,'unauthenticated',url,'')
 await refuse({...input,optionId:'assist'},403,'forbidden_origin',url,f.cookie,{Origin:'https://other.test'})
 // A real late SQLite audit failure rolls back the review and every guard.
 const priorFailure=await custody()
 await env.DB.prepare("CREATE TRIGGER synthetic_review_audit_failure BEFORE INSERT ON audit_entries WHEN NEW.action='learning.option_rejected' BEGIN SELECT RAISE(ABORT,'synthetic-penny-1'); END").run()
 try{expect(await json(call(url+'/reject',{...input,optionId:'assist'},f.cookie,custom),503)).toMatchObject({error:'service_unavailable'})}finally{await env.DB.prepare('DROP TRIGGER synthetic_review_audit_failure').run()}
 expect(await custody()).toEqual(priorFailure)
 await json(call('/api/operator/settings/redaction',{enabled:true,kinds:[],patterns:['synthetic-penny-private-review']},f.cookie,custom,'PUT'))
 const second=await json<{id:string}>(call(url+'/reject',{...input,optionId:'assist',reason:'Check synthetic-penny-private-review before proceeding.'},f.cookie,custom),201)
 const two=await detail()
 expect(two.optionReviews.find(r=>r.id===second.id)?.reason).toBe('Check [REDACTED:custom] before proceeding.')
 expect({...two,optionReviews:[]}).toEqual(before)
 expect(sent).toHaveLength(modelCalls)
 expect(sent.every(wire=>wire.startsWith('POST '))).toBe(true)
 // Native corrections make the old version stale without deleting its reviews.
 const version=await env.DB.prepare('SELECT id FROM evidence_versions WHERE evidence_id=? ORDER BY version_number DESC LIMIT 1').bind(f.evidence.id).first<string>('id')
 await json(call(`/api/operator/evidence/${f.evidence.id}/wording`,{wording:'The report is available, but customers cannot find the handoff.',expectedVersionId:version},f.cookie,custom,'PATCH'))
 await refuse(input,409,'learning_interpretation_stale')
 const refreshed=await json<{artifactId:string}>(call(url+'/run',{},f.cookie,custom)),current=(await detail()).artifacts.find(a=>a.id===refreshed.artifactId)!
 expect(current.id).not.toBe(artifact.id)
 const third=await json<{id:string}>(call(url+'/reject',{...input,interpretationId:current.id,interpretationVersion:current.version,reason:'The corrected original still supports improving the handoff first.'},f.cookie,custom),201)
 const history=(await detail()).optionReviews
 expect(history).toHaveLength(3)
 expect(history).toEqual(expect.arrayContaining(two.optionReviews))
 expect(history.find(r=>r.id===third.id)?.interpretationVersion).toBe(current.version)
 expect((await detail()).commitments).toEqual(before.commitments)
 const exportedDetail=await detail()
 const bundle=await json<Awaited<ReturnType<typeof exportArchive>>>(call('/api/operator/data/export',undefined,f.cookie,custom))
 const rawReviews=(await env.DB.prepare('SELECT * FROM learning_option_reviews ORDER BY id').all()).results
 expect(bundle.archive.tables.learning_option_reviews.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)))).toEqual(rawReviews)
 // Removing the actual reviewer revokes both history reads and the next write.
 // Existing attributed reviews remain readable by a current operator.
 await json(call(`/api/operator/settings/operators/${nativePeerId}`,{},f.cookie,custom,'DELETE'))
 await refuse({...input,interpretationId:current.id,interpretationVersion:current.version,optionId:'assist'},401,'unauthenticated',url,peer)
 expect(await json(call(url,undefined,peer,custom),401)).toMatchObject({error:'unauthenticated'})
 expect(await detail()).toEqual(exportedDetail)
 // Signing out revokes current authority, even for another valid option.
 expect((await call('/api/auth/sign-out',{},f.cookie,custom)).status).toBe(204)
 await refuse({...input,interpretationId:current.id,interpretationVersion:current.version,optionId:'assist'},401,'unauthenticated')
 await reset();await applyD1Migrations(env.DB,inject('migrations'))
 const boot=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Independent restore owner'},'',custom)
 expect(boot.status).toBe(303)
 const destination=boot.headers.get('set-cookie')!.split(';')[0]
 const invalid=structuredClone(bundle)
 invalid.archive.tables.learning_option_reviews[0].option_id='synthetic-penny-unknown'
 const {sha256:ignored,...invalidBody}=invalid.archive;void ignored
 invalid.archive.sha256=await hash(invalidBody)
 expect(await json(call('/api/operator/data/import',invalid,destination,custom),400)).toMatchObject({error:'learning_archive_option_review_invalid'})
 expect((await env.DB.prepare('SELECT * FROM learning_option_reviews').all()).results).toEqual([])
 expect((await json<{status:string}>(call('/api/operator/data/import',bundle,destination,custom))).status).toBe('complete')
 const restored=await detail(destination)
 expect(restored.optionReviews).toEqual(history)
 expect(restored.commitments).toEqual(before.commitments)
 expect(restored.artifacts).toEqual(exportedDetail.artifacts)
 expect(restored.observations).toEqual(exportedDetail.observations)
 const heldCalls=sent.length
 await refuse({...input,interpretationId:current.id,interpretationVersion:current.version,optionId:'assist'},409,'learning_scope_changed',url,destination)
 expect((await call(url+'/run',{},destination,custom)).status).toBe(409)
 expect(sent).toHaveLength(heldCalls)
 const again=await json<typeof bundle>(call('/api/operator/data/export',undefined,destination,custom))
 expect(again.archive.tables.learning_option_reviews).toEqual(bundle.archive.tables.learning_option_reviews)
 const target={table:'requesters',id:requesterId}
 const plan=await json<{planHash:string;counts:Record<string,number>;blockedCopies:unknown[]}>(call('/api/operator/data/erasure/preview',target,destination,custom))
 expect(plan.blockedCopies).toEqual([])
 expect(plan.counts.learning_option_reviews).toBe(3)
 expect((await json<{status:string}>(call('/api/operator/data/erasure',{...target,planHash:plan.planHash},destination,custom))).status).toBe('complete')
 expect((await detail(destination)).optionReviews).toEqual([])
 expect((await detail(destination)).artifacts).toEqual([])
 expect((await env.DB.prepare('SELECT * FROM learning_option_reviews').all()).results).toEqual([])
 expect(await env.DB.prepare('SELECT id FROM requesters WHERE id=?').bind(requesterId).first()).toBeNull()
 expect((await call(url+'/run',{},destination,custom)).status).toBe(409)
 expect(sent).toHaveLength(heldCalls)
 const latest=await json<typeof bundle>(call('/api/operator/data/export',undefined,destination,custom))
 expect(latest.archive.tables.learning_option_reviews).toEqual([])
 expect(latest.journal.epoch).toBeGreaterThan(bundle.journal.epoch)
 // The later journal fences replay of an export that still held the reviews.
 await reset();await applyD1Migrations(env.DB,inject('migrations'))
 const clean=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Clean owner'},'',custom)
 const cleanCookie=clean.headers.get('set-cookie')!.split(';')[0]
 expect(await json(call('/api/operator/data/import',{archive:bundle.archive,journal:latest.journal},cleanCookie,custom),409)).toMatchObject({error:'stale_archive'})
 expect((await env.DB.prepare('SELECT * FROM learning_option_reviews').all()).results).toEqual([])
})
