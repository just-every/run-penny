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
  messages.push({to:body.personalizations[0].to[0].email,url:text.match(/https:\/\/[^\s]+/)[0]})
  return new Response(null,{status:202,headers:{'x-message-id':'test-provider-message'}})
 })
}
let ip=0
export function call(path:string, body?:unknown, headers:Record<string,string>={}, method=body===undefined?'GET':'POST') {
 return exports.default.fetch(new Request(origin+path,{method,redirect:'manual',headers:{Host:'penny.test',Origin:origin,'CF-Connecting-IP':`192.0.2.${++ip}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}))
}
export function finishFirstRun(cookie:{Cookie:string}){
 return exports.default.fetch(new Request(origin+'/setup',{method:'POST',redirect:'manual',headers:{Host:'penny.test',Origin:origin,...cookie,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes'}))
}
// The owner signs in with first-run setup finished, so app documents open; pass false to start from an unfinished setup.
/** The populated-upgrade tests stop the schema at a prior migration, then sign in on it. Base's auth runtime reads its
 * additive provider, domain and dependency tables on every sign-in, so those migrations (0042 to 0049, which touch
 * no product or import table) go in first, as an upgraded installation has them. Later migrations skip what applied. */
async function installAuthSchema(){
 if(await env.DB.prepare("SELECT 1 AS present FROM sqlite_master WHERE name='oa_auth_settings'").first())return
 await applyD1Migrations(env.DB,(inject('migrations') as {name:string}[]).filter(migration=>/^004[2-9]_/.test(migration.name)) as never)
}
export async function owner({finishSetup=true}={}){await installAuthSchema();const r=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner',returnTo:'/app'});expect(r.status,await r.clone().text()).toBe(303);const cookie={Cookie:r.headers.get('Set-Cookie')!.split(';')[0]};// A store still on a prior schema head has no first-run record yet; the migration marks its existing owner done.
if(finishSetup&&await env.DB.prepare("SELECT 1 AS present FROM sqlite_master WHERE name='oa_first_run'").first())expect((await finishFirstRun(cookie)).status).toBe(303);return cookie}
export async function requester(displayName='Private display'){const email=`${crypto.randomUUID()}@example.test`;expect((await call('/api/public/identity/email',{email,displayName})).status).toBe(202);const link=messages.findLast(m=>m.to===email)!;expect(link).toBeDefined();const token=new URLSearchParams(new URL(link.url).hash.slice(1)).get('token');const r=await call('/api/public/identity/email/verify',{token});expect(r.status).toBe(200);return {Authorization:`Bearer ${(await r.json() as {token:string}).token}`}}
