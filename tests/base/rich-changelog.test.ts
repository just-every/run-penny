import {createPortability,readArchive} from '@runeditrun/rer/modules/portability'
import {policy} from '../../scripts/portability/policy'
import {verifyExport} from '../../scripts/portability/verify'
import { exports } from 'cloudflare:workers'
import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterEach,expect,inject,it,vi } from 'vitest'
import { call,env,origin } from './support'
import { graph,time } from './notification-regression-fixture'
import { releaseGraph } from './release-fixture'
import { populateLegacyRelease } from './legacy-release-fixture'
import { restoreArchive } from '@/core/features/data/operations'
import type { Archive,ErasureJournal } from '@/core/features/data/archive'
import type { CurrentPublicRelease } from '@/core/features/releases/public-read-repository'

beforeEach(async()=>{await reset()})
afterEach(()=>vi.restoreAllMocks())
async function result<T>(response:Response,status=200):Promise<T>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>}
it('[REL-015] a populated upgrade preserves published wording, sealed recipients and original rows on repeated migration',async()=>{
 await applyD1Migrations(env.DB,inject('migrations').filter(m=>m.name<'0085'))
 const g=await graph(1),legacy=await populateLegacyRelease(env.DB,g.requests[0].id,time())
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name").all<{name:string}>()).results
 const reads=[]
 for(const table of tables){const columns=(await env.DB.prepare(`PRAGMA table_info("${table.name}")`).all<{name:string}>()).results.map(c=>'"'+c.name+'"');reads.push(`SELECT ${columns.join(',')} FROM "${table.name}" ORDER BY rowid`)}
 const before=(await env.DB.batch(reads.map(sql=>env.DB.prepare(sql)))).map(r=>r.results)
 for(let repeat=0;repeat<2;repeat++){await applyD1Migrations(env.DB,inject('migrations'));expect((await env.DB.batch(reads.map(sql=>env.DB.prepare(sql)))).map(r=>r.results)).toEqual(before)}
 expect(await result(await call(`/api/public/releases/${legacy.slug}`))).toMatchObject({title:legacy.title,body:legacy.body,labels:[],products:[]})
})
it('[REL-015] approved release images, public label/product filters and corrected snapshots respect native authority and publication',async()=>{
 await applyD1Migrations(env.DB,inject('migrations'))
 const g=await releaseGraph(1),base=`/api/operator/releases/${g.draft.slug}`
 const label=await result<{id:string}>(await call('/api/operator/releases/labels',{name:'Automation'},g.operator),201)
 expect((await call('/api/operator/releases/labels',{name:'Secret'},g.person)).status).toBe(401)
 expect((await call('/api/operator/releases/labels',{name:'Elsewhere'},{...g.operator,Origin:'https://elsewhere.test'})).status).toBe(403)
 const product=await result<{id:string}>(await call('/api/operator/hierarchy/product',{name:'Finance'},g.operator),201)
 const component=await result<{id:string}>(await call('/api/operator/hierarchy/component',{name:'Reporting',parentId:product.id},g.operator),201)
 const feature=await result<{id:string}>(await call('/api/operator/hierarchy/feature',{name:'Private feature wording',parentId:component.id},g.operator),201)
 await env.DB.prepare("INSERT INTO penny_feature_roadmap(roadmap_item_id,feature_id,created_at) VALUES('release-item',?,?)").bind(feature.id,time()).run()
 const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6X8AAAAASUVORK5CYII='),c=>c.charCodeAt(0))
 const upload=async(file:File,headers=g.operator)=>{const form=new FormData();form.set('file',file);return exports.default.fetch(new Request(origin+base+'/attachments',{method:'POST',headers:{Origin:origin,...headers},body:form}))}
 expect((await upload(new File(['<svg onload="alert(1)"/>'],'bad.png',{type:'image/png'}))).status).toBe(400)
 const image=await result<{id:string;url:string}>(await upload(new File([bytes],'chart.png',{type:'image/png'})),201)
 expect((await call(image.url)).status).toBe(404)
 await env.DB.prepare("UPDATE release_attachments SET state='writing' WHERE id=?").bind(image.id).run()
 const recovery=async(stopped:boolean)=>{const form=new FormData();form.set('file',new File([bytes],'chart.png',{type:'image/png'}));if(stopped)form.set('writerStopped','yes');return exports.default.fetch(new Request(origin+base+`/attachments/${image.id}/recover`,{method:'POST',headers:{Origin:origin,...g.operator},body:form}))}
 expect((await recovery(false)).status).toBe(409)
 expect((await recovery(true)).status).toBe(200)
 const body=`## Faster reporting\n\n**Ready** for customers.\n\n![Monthly report](${image.url})\n\n[Watch walkthrough](https://www.youtube.com/watch?v=dQw4w9WgXcQ)\n\n<script>window.stolen=true</script>\n\n![Untrusted](https://tracker.example/image.png)`
 await result(await call(base,{...g.input,body,labelIds:[label.id],productIds:[product.id]},g.operator,'PATCH'))
 expect((await call(base+'/publish',{},g.operator)).status).toBe(409)
 await result(await call(`${base}/attachments/${image.id}/approve`,{},g.operator))
 expect((await call(image.url)).status).toBe(404)
 await result(await call(base+'/publish',{},g.operator))
 const imageResponse=await call(image.url);expect(imageResponse.status).toBe(200);expect(new Uint8Array(await imageResponse.arrayBuffer())).toEqual(bytes)
 const published=await result<CurrentPublicRelease>(await call(`/api/public/releases/${g.draft.slug}`))
 expect(published).toMatchObject({body,labels:[{id:label.id,name:'Automation'}],products:[{id:product.id,name:'Finance'}]})
 expect(JSON.stringify(published)).not.toContain('Private feature wording')
 const other=await result<{slug:string}>(await call('/api/operator/releases',{...g.input,title:'Other release',releaseType:'fixed',labelIds:[],productIds:[product.id]},g.operator),201)
 await result(await call(`/api/operator/releases/${other.slug}/publish`,{},g.operator))
 expect((await call(`/api/public/releases/${other.slug}/attachments/${image.id}`)).status).toBe(404)
 const list=async(query:string)=>result<CurrentPublicRelease[]>(await call('/api/public/releases'+query))
 expect((await list(`?label=${label.id}`)).map(r=>r.slug)).toEqual([g.draft.slug])
 expect((await list('?label=fixed')).map(r=>r.slug)).toEqual([other.slug])
 expect(await list(`?label=${label.id}&product=missing`)).toEqual([])
 expect((await list(`?product=${product.id}`)).map(r=>r.slug).sort()).toEqual([g.draft.slug,other.slug].sort())
 await result(await call(`/api/operator/hierarchy/product/${product.id}`,{name:'Renamed private product'},g.operator,'PATCH'))
 const correction=await result<{versionId:string}>(await call(base+'/corrections',{expectedVersionId:g.draft.versionId,title:'Corrected report',body:body+'\n\nMore detail.'},g.operator),201)
 expect(await result(await call(`/api/public/releases/${g.draft.slug}`))).toMatchObject({labels:published.labels,products:published.products,title:'Corrected report'})
 await expect(env.DB.prepare("UPDATE release_versions SET public_labels_json='[]' WHERE id=?").bind(correction.versionId).run()).rejects.toThrow('immutable')
 const saved=await result<{archive:Archive;journal:ErasureJournal}>(await call('/api/operator/data/export',undefined,g.operator))
 expect(saved.archive.tables.release_labels).toEqual(expect.arrayContaining([expect.objectContaining({id:label.id,name:'Automation'})]))
 expect(saved.archive.tables.release_attachments).toEqual([expect.objectContaining({id:image.id,state:'approved'})])
 expect(saved.archive.files.some(file=>file.key===saved.archive.tables.release_attachments[0].storage_key)).toBe(true)
 const portable=await createPortability({db:env.DB,buckets:{FILES:env.FILES},policy:policy(saved.journal)})
 const job=await portable.exports.create()
 try{
  while((await portable.exports.advance(job,{maxParts:16})).phase==='building'){}
  const archiveBytes=await new Response(await portable.exports.download(job)).arrayBuffer()
  await verifyExport(env.DB,new Response(archiveBytes).body!,saved.journal)
  let imageFound=false
  for await(const record of readArchive(new Response(archiveBytes).body!))if(record.kind==='manifest')imageFound=record.objects.some(object=>object.key===saved.archive.tables.release_attachments[0].storage_key&&object.sha256===saved.archive.files.find(file=>file.key===object.key)!.sha256)
  expect(imageFound).toBe(true)
 }finally{await portable.exports.abort(job)}
 const hosted=await result<{id:string}>(await call('/api/portability/exports',{},g.operator),201)
 try{
  while((await result<{phase:string}>(await call(`/api/portability/exports/${hosted.id}/advance`,{maxParts:100},g.operator))).phase==='building'){}
  const download=await call(`/api/portability/exports/${hosted.id}/download`,undefined,g.operator)
  expect(download.status).toBe(200)
  let found=false
  for await(const record of readArchive(download.body!))if(record.kind==='manifest')found=record.objects.some(object=>object.key===saved.archive.tables.release_attachments[0].storage_key)
  expect(found).toBe(true)
 }finally{await result(await call(`/api/portability/exports/${hosted.id}/abort`,{},g.operator))}
 await reset();await applyD1Migrations(env.DB,inject('migrations'))
 expect((await restoreArchive(env.DB,env.FILES,saved.archive,saved.journal)).status).toBe('complete')
 expect(await result(await call(`/api/public/releases/${g.draft.slug}`))).toMatchObject({labels:published.labels,products:published.products,title:'Corrected report'})
 const restoredImage=await call(image.url);expect(restoredImage.status).toBe(200);expect(new Uint8Array(await restoredImage.arrayBuffer())).toEqual(bytes)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
