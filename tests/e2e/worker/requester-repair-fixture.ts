import { applyD1Migrations } from 'cloudflare:test'
import { beforeAll,beforeEach,inject,expect } from 'vitest'
import { env,fixture,person,submit,publish,call,auth } from './requester-board-fixture'
export * from './requester-board-fixture'
export function repairDatabase() {
  beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'))})
  beforeEach(async()=>{
    const tables=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'data_%' AND name!='d1_migrations'").all<{name:string}>()
    await env.DB.batch([env.DB.prepare('PRAGMA defer_foreign_keys=ON'),...tables.results.map(t=>env.DB.prepare(`DELETE FROM "${t.name}"`))])
  })
}
export async function boardGraph(count=3) {
  const f=await fixture(),owner=await person(),requests=[] as {slug:string;id:string}[]
  for(let i=0;i<count;i++){
    const r=await submit(f.board,owner.token,`Original ${i}`);await publish(r.slug,f.board,f.headers,`Public ${i}`)
    const row=await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(r.slug).first<{id:string}>()
    requests.push({...r,id:row!.id})
  }
  return {...f,owner,requests}
}
export async function change(slug:string,kind:string,token:string,body:unknown={},method='POST') {
  const response=await call(`/api/public/requests/${slug}/${kind}`,body,auth(token),method)
  expect(response.status,await response.clone().text()).toBe(204)
}
export async function merge(source:string,target:string,headers:Record<string,string>) {
  const response=await call(`/api/operator/requests/${source}/merge`,{targetSlug:target},headers)
  expect(response.status,await response.clone().text()).toBe(200)
}
export async function unmerge(source:string,headers:Record<string,string>) {
  const response=await call(`/api/operator/requests/${source}/unmerge`,{},headers)
  expect(response.status,await response.clone().text()).toBe(200)
}
export async function graphSnapshot() {
  const tables=['requests','request_votes','request_follows','request_evidence_links','request_vote_contributions','request_follow_contributions','request_evidence_contributions','request_merges','request_merge_vote_transfers','request_merge_follow_transfers','request_merge_evidence_transfers','request_comments','attachments','evidence_items','evidence_versions','requester_update_permissions','audit_entries']
  const results=await env.DB.batch(tables.map(table=>env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`)))
  return Object.fromEntries(tables.map((table,i)=>[table,results[i].results]))
}
