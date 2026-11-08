import { env, exports } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { expect,inject,vi } from 'vitest'
export { env }
export const origin='https://penny.test'
export const messages: {to:string;url:string}[]=[]
export function mockMail(){
 messages.length=0
 vi.spyOn(globalThis,'fetch').mockImplementation(async (input,init)=>{
  if (String(input)!=='https://api.sendgrid.com/v3/mail/send' || init?.method!=='POST') throw new Error('Unexpected outbound request')
  const body=JSON.parse(String(init.body));const text=body.content.find((c:{type:string})=>c.type==='text/plain').value
  messages.push({to:body.personalizations[0].to[0].email,url:text.match(/https?:\/\/[^\s]+/)[0]})
  return new Response(null,{status:202,headers:{'x-message-id':'test-provider-message'}})
 })
}
let ip=0
export function call(path:string, body?:unknown, headers:Record<string,string>={}, method=body===undefined?'GET':'POST') {
 return exports.default.fetch(new Request(origin+path,{method,redirect:'manual',headers:{Host:'penny.test',Origin:origin,'CF-Connecting-IP':`198.18.${Math.floor(ip / 254) % 256}.${++ip % 254 + 1}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}))
}
export function uploadRequestAttachment(slug:string,file:File,identity:Record<string,string>){
 const body=new FormData();body.set('file',file)
 return exports.default.fetch(new Request(origin+`/api/public/requests/${slug}/attachments`,{method:'POST',headers:{Origin:origin,...identity},body}))
}
/** Snapshot the business graph touched by a merge, including its late audit and notice writes. */
export async function requestMergeCustody(){
 const tables=['requests','request_canonical_roots','request_merges','request_merge_evidence_transfers','request_merge_vote_transfers','request_merge_follow_transfers','request_merge_comment_transfers','request_merge_attachment_transfers','request_votes','request_vote_contributions','request_follows','request_follow_contributions','request_evidence_links','request_evidence_contributions','evidence_items','evidence_versions','request_comments','attachments','request_attachment_uploads','requester_update_permissions','requester_addresses','request_tag_assignments','request_status_updates','penny_request_status','penny_merge_notices','penny_merge_notice_recipients','notification_events','notification_intents','notification_batches','notification_outbox','audit_entries']
 const results=await env.DB.batch<Record<string,unknown>>(tables.map(table=>env.DB.prepare(`SELECT * FROM ${table}`)))
 return Object.fromEntries(tables.map((table,index)=>[table,results[index].results.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]))
}
export function finishFirstRun(cookie:{Cookie:string},timezone='Australia/Brisbane'){
 return exports.default.fetch(new Request(origin+'/setup',{method:'POST',redirect:'manual',headers:{Host:'penny.test',Origin:origin,...cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',companyName:'Test business',postalAddress:'1 Test Street',timezone,quietEnabled:'yes',quietStart:'20',quietEnd:'8'}).toString() }))
}
// The owner signs in with first-run setup finished, so app documents open; pass false to start from an unfinished setup.
/** Populated-upgrade fixtures use current HTTP admission to create historical
 * product rows. Install its additive auth, integration guard, admission, capture-policy
 * and evidence-writer prerequisites first; the product/import schema remains at the chosen head.
 * The upgrade still compares every prior table/column and skips applied SQL. */
async function installCurrentWritePrerequisites(){
 const tables=new Set((await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('oa_auth_settings','penny_integration_guards','penny_public_admission','penny_redaction_settings')").all<{name:string}>()).results.map(row=>row.name))
 const evidenceColumns=(await env.DB.prepare('PRAGMA table_info(evidence_items)').all<{name:string}>()).results
 const needsProvenance=evidenceColumns.length>0&&!evidenceColumns.some(column=>column.name==='admitted_sender')
 const prerequisites=(inject('migrations') as {name:string}[]).filter(migration=>
  (!tables.has('oa_auth_settings')&&/^004[2-9]_/.test(migration.name))
  ||(!tables.has('penny_integration_guards')&&/^002[01]_/.test(migration.name))
  ||(!tables.has('penny_public_admission')&&/^0055_/.test(migration.name))
  ||(!tables.has('penny_redaction_settings')&&/^0090_/.test(migration.name))
  ||(needsProvenance&&/^0091_/.test(migration.name)))
 if(prerequisites.length)await applyD1Migrations(env.DB,prerequisites as never)
}
export async function owner({finishSetup=true,timezone='Australia/Brisbane'}={}){await installCurrentWritePrerequisites();const r=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner',returnTo:'/app'});expect(r.status,await r.clone().text()).toBe(303);const cookie={Cookie:r.headers.get('Set-Cookie')!.split(';')[0]};// A store still on a prior schema head has no first-run record yet; the migration marks its existing owner done.
if(finishSetup&&await env.DB.prepare("SELECT 1 AS present FROM sqlite_master WHERE name='penny_mail_identity'").first()){if(!await env.DB.prepare("SELECT 1 AS present FROM sqlite_master WHERE name='penny_workspace_clock'").first())await applyD1Migrations(env.DB,(inject('migrations') as {name:string}[]).filter(migration=>/^0072_/.test(migration.name)) as never);expect((await finishFirstRun(cookie,timezone)).status).toBe(303)}return cookie}
export async function requester(displayName='Private display'){const email=`${crypto.randomUUID()}@example.test`;expect((await call('/api/public/identity/email',{email,displayName})).status).toBe(202);const link=messages.findLast(m=>m.to===email)!;expect(link).toBeDefined();const token=new URLSearchParams(new URL(link.url).hash.slice(1)).get('token');const r=await call('/api/public/identity/email/verify',{token});expect(r.status).toBe(200);return {Authorization:`Bearer ${(await r.json() as {token:string}).token}`}}
