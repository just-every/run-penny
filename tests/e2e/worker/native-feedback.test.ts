import { nativeAuthoritySettings, nativeOwnerCookie } from '../../predecessor-native-authority'
import { applyD1Migrations, type D1Migration } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeAll,describe,expect,inject,it } from 'vitest'
import { createPennyApi } from '../../../src/core/app/api'
import { createDatabaseConnection } from '../../../src/core/platform/database'
import { importPennySample } from '../../../src/core/features/sample-data/service'
import sample from '../../../sample-data/penny.v1.json'
import { createUlid } from '../../../src/core/shared/ulid'
import { digest } from '../../../src/core/features/auth/native-tokens'
const app=createPennyApi({runtimeConfiguration:{operatorAllowlist:['owner@penny.invalid'],workspaceTimezone:'Australia/Brisbane',publicOriginAllowlist:['http://localhost:15300']}})
const bindings={...env,...nativeAuthoritySettings,PENNY_ENVIRONMENT:'test',PENNY_AUTH_TRANSPORT:'local-outbox'}
let nativeCookie=''
let testIp=1
const request=(path:string,body?:unknown,headers:Record<string,string>={},transport=true)=>app.fetch(new Request(`${bindings.APP_ORIGIN}${path}`,{method:body===undefined?'GET':'POST',headers:{'CF-Connecting-IP':`192.0.2.${testIp++}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),transport?bindings:{...bindings,PENNY_AUTH_TRANSPORT:undefined})
const randomEmail=()=>`${crypto.randomUUID()}@example.test`
async function mail(email:string,purpose:string){return (await env.DB.prepare('SELECT token FROM local_auth_outbox WHERE recipient=? AND purpose=? ORDER BY created_at DESC LIMIT 1').bind(email,purpose).first<{token:string}>())!.token}
// Current guarded writes additionally require separately issued Base authority.
async function operator(){expect((await request('/api/auth/magic-link',{email:'owner@penny.invalid'})).status).toBe(202);const response=await request(`/api/auth/magic-link/consume?token=${await mail('owner@penny.invalid','operator')}`);expect(response.status).toBe(302);nativeCookie=await nativeOwnerCookie(bindings,nativeCookie);return `${response.headers.get('Set-Cookie')!.split(';')[0]}; ${nativeCookie}`}
async function requester(){const email=randomEmail();expect((await request('/api/public/identity/email',{email,displayName:'Private original name'})).status).toBe(202);const response=await request('/api/public/identity/email/verify',{token:await mail(email,'requester')});expect(response.status).toBe(200);expect(response.headers.get('Set-Cookie')).toBeNull();return {email,...await response.json() as {token:string}}}
function submission(){return {title:`Private original ${crypto.randomUUID()}`,description:'Private original wording',boardSlug:'enterprise-identity',proposedSolution:'Sensitive proposed solution',impactStatement:'Sensitive impact',idempotencyKey:crypto.randomUUID()}}
const bearer=(token:string)=>({Authorization:`Bearer ${token}`})
beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'));await importPennySample(createDatabaseConnection(env.DB),sample)})
describe('bounded native identity and feedback journey',()=>{
  it('[BASE-ACCESS-001] fails loudly without delivery and does not enumerate operator admission',async()=>{
    expect((await request('/api/auth/magic-link',{email:'owner@penny.invalid'},{},false)).status).toBe(503)
    const email=randomEmail();const response=await request('/api/auth/magic-link',{email});expect(response.status).toBe(202);expect(await response.json()).toEqual({accepted:true});expect(await env.DB.prepare('SELECT id FROM local_auth_outbox WHERE recipient=?').bind(email).first()).toBeNull()
  })
  it('[BASE-ACCESS-003 BASE-SECRET-001] never exposes an HTTP outbox and refuses synthetic transport for remote origins and production',async()=>{
    expect((await request('/api/auth/outbox')).status).toBe(404)
    const body=JSON.stringify({email:'owner@penny.invalid'})
    for(const extra of [{APP_ORIGIN:'https://remote.test'},{PENNY_ENVIRONMENT:'production',APP_ORIGIN:'https://remote.test',AUTH_SECRET:'synthetic-test-secret',MAIL_FROM:'local@example.test',MAIL_PROVIDER_API_KEY:'synthetic-no-provider-key',MAIL_WEBHOOK_SECRET:'synthetic-test-webhook'}]){
      const result=await app.fetch(new Request(bindings.APP_ORIGIN+'/api/auth/magic-link',{method:'POST',headers:{'Content-Type':'application/json'},body}),{...bindings,...extra})
      expect(result.status).toBe(503);expect(await result.text()).not.toContain('token')
    }
    expect((await request('/api/public/identity/email',{email:randomEmail(),displayName:'x'.repeat(40000)})).status).toBe(400)
  })
  it('[BASE-ACCESS-001/002] atomically consumes one link, rejects replay/expiry and revokes sign-out',async()=>{
    const cookie=await operator();expect((await request('/api/auth/session',undefined,{Cookie:cookie,Origin:bindings.APP_ORIGIN})).status).toBe(200)
    expect((await request('/api/auth/sign-out',{}, {Cookie:cookie,Origin:bindings.APP_ORIGIN})).status).toBe(204);expect((await request('/api/auth/session',undefined,{Cookie:cookie,Origin:bindings.APP_ORIGIN})).status).toBe(401)
    const email=randomEmail();await request('/api/public/identity/email',{email,displayName:'Expiry'});const token=await mail(email,'requester');await env.DB.prepare("UPDATE native_magic_links SET expires_at='2000-01-01' WHERE token_hash=?").bind(await digest(token)).run();expect((await request('/api/public/identity/email/verify',{token})).status).toBe(401)
    const email2=randomEmail();await request('/api/public/identity/email',{email:email2,displayName:'Race'});const token2=await mail(email2,'requester');const responses=await Promise.all([request('/api/public/identity/email/verify',{token:token2}),request('/api/public/identity/email/verify',{token:token2})]);expect(responses.map(r=>r.status).sort()).toEqual([200,401]);expect((await request('/api/public/identity/email/verify',{token:token2})).status).toBe(401)
  })
  it('[BASE-ACCESS-004] rejects cross-site mutation, unknown fields and unverified identity',async()=>{
    expect((await request('/api/auth/magic-link',{email:'owner@penny.invalid'},{Origin:'https://foreign.test'})).status).toBe(403)
    expect((await request('/api/auth/sign-out',{}, {'Sec-Fetch-Site':'cross-site'})).status).toBe(403)
    expect((await request('/api/public/identity/email',{email:randomEmail(),displayName:'Good',operatorId:'forged'})).status).toBe(400)
    expect((await request('/api/public/requests',submission())).status).toBe(401)
    expect((await request('/api/operator/moderation')).status).toBe(401)
    expect((await request('/api/operator/moderation/missing',{verdict:'rejected',reason:'No'})).status).toBe(401)
  })
  it('[REQ-003/005/013 DATA-002 EVID-001/006] creates one durable graph, moderates safe fields, and preserves original evidence',async()=>{
    const identity=await requester(),input={...submission(),title:'private-merger-cedar-acquisition'};const results=await Promise.all([request('/api/public/requests',input,bearer(identity.token)),request('/api/public/requests',input,bearer(identity.token))]);expect(results.map(r=>r.status)).toEqual([201,201]);const first=await results[0].json() as {slug:string};expect(first.slug).toMatch(/^feedback-[0-9a-hjkmnp-tv-z]{26}$/);expect(first.slug).not.toContain('cedar');expect(await results[1].json()).toMatchObject(first)
    const hidden=await request(`/api/public/requests/${first.slug}`);expect(hidden.status).toBe(404)
    expect((await request('/api/public/requests',{...input,title:'Changed'},bearer(identity.token))).status).toBe(409)
    const graph=await env.DB.prepare('SELECT COUNT(*) AS count FROM request_evidence_links l JOIN requests r ON r.id=l.request_id WHERE r.slug=?').bind(first.slug).first<{count:number}>();expect(graph?.count).toBe(1)
    const cookie=await operator();expect((await request('/api/operator/moderation',undefined,{Cookie:cookie,Origin:bindings.APP_ORIGIN})).status).toBe(200)
    const approval={verdict:'approved',title:'Customer-safe published title',description:'Customer-safe public wording',boardSlug:'enterprise-identity',displayName:'Approved public name'}
    expect((await request(`/api/operator/moderation/${first.slug}`,approval,{Cookie:cookie,Origin:bindings.APP_ORIGIN})).status).toBe(200)
    const published=await request(`/api/public/requests/${first.slug}`),body=await published.text();expect(published.status).toBe(200);expect(body).toContain(approval.title);expect(body).toContain(approval.displayName);for(const value of [identity.email,input.title,input.description,input.proposedSolution,input.impactStatement,'Private original name'])expect(body).not.toContain(value)
    const wording=await env.DB.prepare('SELECT v.wording FROM evidence_versions v JOIN request_evidence_links l ON l.evidence_id=v.evidence_id JOIN requests r ON r.id=l.request_id WHERE r.slug=?').bind(first.slug).first<{wording:string}>();expect(wording?.wording).toContain(input.description)
    const audit=await env.DB.prepare('SELECT count(*) AS count FROM audit_entries WHERE entity_id=(SELECT id FROM requests WHERE slug=?)').bind(first.slug).first<{count:number}>();expect(audit?.count).toBe(2)
    expect((await request(`/api/operator/moderation/${first.slug}`,approval,{Cookie:cookie,Origin:bindings.APP_ORIGIN})).status).toBe(409)
  })
  it('[REQ-005 DATA-002] uses an opaque valid public slug for titles ending at a punctuation boundary',async()=>{
    const identity=await requester(),input={...submission(),title:'a'.repeat(59)+' b'}
    const created=await request('/api/public/requests',input,bearer(identity.token));expect(created.status).toBe(201)
    const result=await created.json() as {slug:string};expect(result.slug).not.toContain('--');expect(result.slug).not.toContain('a'.repeat(10))
    const cookie=await operator();expect((await request(`/api/operator/moderation/${result.slug}`,{verdict:'approved',title:'Safe title',description:'Safe description',boardSlug:'enterprise-identity',displayName:'Safe name'},{Cookie:cookie,Origin:bindings.APP_ORIGIN})).status).toBe(200)
    expect((await request(`/api/public/requests/${result.slug}`)).status).toBe(200)
  })
  it('[REQ-005/018/019/022] refuses blocked identity, unavailable boards and rejected publication',async()=>{
    const identity=await requester();await env.DB.prepare('UPDATE requesters SET blocked_at=? WHERE id=(SELECT requester_id FROM requester_addresses WHERE email=?)').bind(new Date().toISOString(),identity.email).run();expect((await request('/api/public/requests',submission(),bearer(identity.token))).status).toBe(403)
    const good=await requester();
    for(const [slug,visibility,archived] of [['native-internal','internal',null],['native-archived','public','2026-10-02']] as const){await env.DB.prepare('INSERT INTO boards(id,slug,name,visibility,position,archived_at,created_at,updated_at) VALUES(?,?,?,?,0,?,?,?)').bind(createUlid(),slug,slug,visibility,archived,new Date().toISOString(),new Date().toISOString()).run();expect((await request('/api/public/requests',{...submission(),boardSlug:slug},bearer(good.token))).status).toBe(409)}
    expect((await request('/api/public/requests',{...submission(),boardSlug:'missing'},bearer(good.token))).status).toBe(409)
    const input=submission(),first=await (await request('/api/public/requests',input,bearer(good.token))).json() as {slug:string};const cookie=await operator()
    expect((await request(`/api/operator/moderation/${first.slug}`,{verdict:'rejected',reason:''},{Cookie:cookie,Origin:bindings.APP_ORIGIN})).status).toBe(400)
    expect((await request(`/api/operator/moderation/${first.slug}`,{verdict:'approved',title:'Safe',description:'Safe',boardSlug:'missing',displayName:'Safe'},{Cookie:cookie,Origin:bindings.APP_ORIGIN})).status).toBe(409)
    expect((await request(`/api/operator/moderation/${first.slug}`,{verdict:'approved',title:'Safe',description:'Safe',boardSlug:'native-internal',displayName:'Safe'},{Cookie:cookie,Origin:bindings.APP_ORIGIN})).status).toBe(409)
    expect((await request(`/api/operator/moderation/${first.slug}`,{verdict:'rejected',reason:'Not enough detail'},{Cookie:cookie,Origin:bindings.APP_ORIGIN})).status).toBe(200);expect((await request(`/api/public/requests/${first.slug}`)).status).toBe(404)
  })
  it('[REQ-003/013] rolls back request/evidence/key/audit together on a storage failure',async()=>{
    const identity=await requester(),input=submission()
    await env.DB.exec("CREATE TRIGGER synthetic_fail_evidence BEFORE INSERT ON evidence_versions BEGIN SELECT RAISE(ABORT,'synthetic storage failure'); END;")
    try {expect((await request('/api/public/requests',input,bearer(identity.token))).status).toBe(503);expect(await env.DB.prepare('SELECT id FROM requests WHERE title=?').bind(input.title).first()).toBeNull();expect(await env.DB.prepare('SELECT key_hash FROM request_submission_keys WHERE key_hash=?').bind(await digest(`${(await env.DB.prepare('SELECT requester_id AS id FROM requester_addresses WHERE email=?').bind(identity.email).first<{id:string}>())!.id}:${input.idempotencyKey}`)).first()).toBeNull()}finally{await env.DB.exec('DROP TRIGGER synthetic_fail_evidence')}
    expect((await request('/api/public/requests',input,bearer(identity.token))).status).toBe(201)
  })
  it('[BASE-ACCESS-003] enforces durable identity action limits',async()=>{
    const email=randomEmail();const statuses=[];for(let i=0;i<6;i++)statuses.push((await request('/api/public/identity/email',{email,displayName:'Rate limit'},{'CF-Connecting-IP':'192.0.2.99'})).status);expect(statuses).toEqual([202,202,202,202,202,429])
  })
})

it('[DATA-002] repairs prior native slugs without changing references or curated URLs',async()=>{
  const who=await requester(),input=submission(),response=await request('/api/public/requests',input,bearer(who.token))
  expect(response.status).toBe(201)
  const {slug}=await response.json() as {slug:string}
  const before=await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(slug).first<{id:string}>()
  const curated=await env.DB.prepare('SELECT id,slug FROM requests WHERE id NOT IN (SELECT request_id FROM request_submission_keys) ORDER BY id').all()
  const graph=await env.DB.prepare('SELECT * FROM request_evidence_links WHERE request_id=?').bind(before!.id).all()
  await env.DB.prepare("UPDATE requests SET slug='private-old-title' WHERE id=?").bind(before!.id).run()
  const migration=(inject('migrations') as D1Migration[]).find(m=>m.name==='0003_opaque_native_request_slugs.sql')!
  expect(migration).toBeDefined()
  await env.DB.batch(migration.queries.map(query=>env.DB.prepare(query)))
  expect(await env.DB.prepare('SELECT id,slug FROM requests WHERE id=?').bind(before!.id).first()).toEqual({id:before!.id,slug})
  expect((await env.DB.prepare('SELECT * FROM request_evidence_links WHERE request_id=?').bind(before!.id).all()).results).toEqual(graph.results)
  expect((await env.DB.prepare('SELECT id,slug FROM requests WHERE id NOT IN (SELECT request_id FROM request_submission_keys) ORDER BY id').all()).results).toEqual(curated.results)
})
