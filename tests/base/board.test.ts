import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterEach,vi, expect,inject,it } from 'vitest'
import { call,env,owner,requester,mockMail,origin } from './support'
import { exports } from 'cloudflare:workers'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()});afterEach(()=>vi.restoreAllMocks())
async function graph(){
 const operator=await owner(),person=await requester()
 expect((await call('/api/operator/boards',{name:'Product feedback',slug:'product',visibility:'public'},operator)).status).toBe(201)
 async function submit(title:string){const r=await call('/api/public/requests',{title,description:'Private first-post wording',boardSlug:'product',idempotencyKey:crypto.randomUUID()},person);expect(r.status).toBe(201);return (await r.json() as {slug:string}).slug}
 async function approve(slug:string,title:string){expect((await call(`/api/operator/moderation/${slug}`,{verdict:'approved',title,description:'Approved public wording',boardSlug:'product',displayName:'Public requester'},operator)).status).toBe(200)}
 return {operator,person,submit,approve}
}
it('[REQ-003/006/007/008/009/010/015] Base-signed operator moderates first posts, comments, status and merge reversal with real requester mail',async()=>{
 const g=await graph(),a=await g.submit('Private source'),b=await g.submit('Private target')
 expect((await call(`/api/public/requests/${a}`)).status).toBe(404)
 await g.approve(a,'Source');await g.approve(b,'Target')
 for(const slug of [a,b]){
  expect((await call(`/api/public/requests/${slug}/vote`,{},g.person)).status).toBe(204)
  expect((await call(`/api/public/requests/${slug}/vote`,{},g.person)).status).toBe(204)
  expect((await call(`/api/public/requests/${slug}/follow`,{},g.person)).status).toBe(204)
 }
 const comment=await call(`/api/public/requests/${a}/comments`,{body:'Held comment'},g.person);expect(comment.status).toBe(201)
 const {id}=await comment.json() as {id:string}
 expect(await (await call(`/api/public/requests/${a}`)).json()).toMatchObject({voteCount:1,comments:[]})
 expect((await call(`/api/operator/comments/${id}/moderate`,{verdict:'approved',publicAuthorDisplayName:'Approved person'},g.operator)).status).toBe(200)
 expect((await call(`/api/operator/requests/${a}/status-updates`,{status:'under_review',body:'Reviewing this request.',pinned:true},g.operator)).status).toBe(200)
 expect((await call(`/api/operator/requests/${a}/merge`,{targetSlug:b},g.operator)).status).toBe(200)
 expect((await call(`/api/public/requests/${a}`)).status).toBe(301)
 expect(await (await call(`/api/public/requests/${b}`)).json()).toMatchObject({voteCount:1,comments:[{body:'Held comment'}]})
 expect((await call(`/api/operator/requests/${a}/unmerge`,{},g.operator)).status).toBe(200)
 const published=await (await call(`/api/public/requests/${a}`)).text();expect(published).toContain('Held comment');expect(published).toContain('Reviewing this request.');expect(published).not.toContain('Private first-post wording')
 const actor=await env.DB.prepare('SELECT id FROM operators WHERE email=?').bind('owner@penny.invalid').first<{id:string}>();expect(actor!.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
 expect((await env.DB.prepare('SELECT count(*) AS n FROM operator_sessions').first<{n:number}>())!.n).toBe(0)
})
it('[REQ-011/018/019 EVID-009] Base-signed board/tag management preserves private tags and separate file approval',async()=>{
 const g=await graph(),slug=await g.submit('With attachment');await g.approve(slug,'Public attachment request')
 const tag=await call('/api/operator/catalog/tags',{name:'Private enterprise context'},g.operator);expect(tag.status).toBe(201)
 const tagId=(await tag.json() as {id:string}).id
 const requestId=(await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(slug).first<{id:string}>())!.id
 expect((await call(`/api/operator/catalog/requests/${requestId}/tags/${tagId}`,{},g.operator,'PUT')).status).toBe(200)
 const form=new FormData();form.set('file',new File([new Uint8Array([137,80,78,71])],'diagram.png',{type:'image/png'}))
 const upload=await exports.default.fetch(new Request(origin+`/api/public/requests/${slug}/attachments`,{method:'POST',headers:{...g.person,Origin:origin},body:form}));expect(upload.status).toBe(201)
 const file=(await upload.json() as {id:string}).id
 expect((await call(`/api/public/attachments/${file}`)).status).toBe(404)
 expect((await call(`/api/operator/attachments/${file}/moderate`,{verdict:'approved'},g.operator)).status).toBe(200)
 expect(new Uint8Array(await (await call(`/api/public/attachments/${file}`)).arrayBuffer())).toEqual(new Uint8Array([137,80,78,71]))
 expect(await (await call(`/api/public/requests/${slug}`)).text()).not.toContain('Private enterprise context')
 expect((await call('/api/operator/boards/product',{visibility:'internal'},g.operator,'PATCH')).status).toBe(200)
 expect((await call(`/api/public/requests/${slug}`)).status).toBe(404);expect((await call(`/api/public/attachments/${file}`)).status).toBe(404)
})
