import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,afterEach,expect,inject,it,vi} from 'vitest'
import {restoreArchive} from '@/core/features/data/operations'
import {Buffer} from 'node:buffer'
import {call,env,owner,mockMail} from './support'
import {apply,complete,importPath,preview} from './feedback-import-fixture'
import {stableFeedbackId} from '@/core/features/imports/mapping-support'
import {defaultImportColumns} from '@/core/features/imports/status-roadmap-policy'
import type {SavedFeedbackInput} from '@/core/features/imports/types'

beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()})
afterEach(()=>vi.restoreAllMocks())
const root='/api/operator/settings/status-roadmap',created='2024-07-08T09:10:11Z'
function source(namespace:string):SavedFeedbackInput{
 return {namespace,statuses:{planned:'planned',complete:'shipped',open:'open'},roadmap:{boardIds:['finance'],columns:defaultImportColumns.map(c=>({...c,label:c.status==='planned'?'Coming next':c.label,visible:c.status!=='under_review'})),shippedDays:null},boards:[{id:'finance',name:'Finance history',isPrivate:false,created},{id:'staff',name:'Staff only',isPrivate:true,created}],files:[{name:'posts.json',kind:'posts',version:'v1',base64:Buffer.from(JSON.stringify({posts:['planned','complete','open'].map((status,i)=>({id:'post-'+i,title:['Scheduled exports','Faster exports','Custom columns'][i],details:'Finance workflow '+i,status,board:{id:'finance'},author:{id:'person',name:'Avery Morgan',created},created}))})).toString('base64')}]}
}
async function json(response:Response,status=200):Promise<any>{expect(response.status,await response.clone().text()).toBe(status);return response.json()}
it('[ROAD-014 IMP-002 IMP-004] rebuilds a reviewed Canny roadmap, preserves moderation and source statuses, replays without mail and restores prior settings on undo',async()=>{
 let operator=await owner()
 const input=source('roadmap-custody'),before=(await json(await call(root,undefined,operator))).settings
 const job=await apply(input,operator),settings=(await json(await call(root,undefined,operator))).settings
 expect(settings).toMatchObject({source:'request_statuses',columns:input.roadmap!.columns,shippedDays:null,boardSlugs:['import-'+stableFeedbackId(input.namespace,'boards','finance').toLowerCase()]})
 expect((await apply(input,operator)).id).toBe(job.id)
 expect(await json(await call('/api/public/roadmap'))).toEqual([])
 const bundle=await json(await call('/api/operator/data/export',undefined,operator))
 expect(bundle.archive.tables.penny_import_roadmaps).toHaveLength(1)
 await reset();await applyD1Migrations(env.DB,inject('migrations'))
 await restoreArchive(env.DB,env.FILES,bundle.archive,bundle.journal)
 operator=await owner()
 expect((await json(await call(root,undefined,operator))).settings).toEqual(settings)
 await complete(await json(await call(`${importPath}/jobs/${job.id}/undo`,{},operator)),operator)
 expect((await json(await call(root,undefined,operator))).settings).toEqual(before)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM boards').first('n')).toBe(0)
 await apply(input,operator)
 const slug=(i:number)=>'feedback-'+stableFeedbackId(input.namespace,'posts','post-'+i).toLowerCase()
 for(const i of [0,1,2])await json(await call('/api/operator/moderation/'+slug(i),{verdict:'approved',title:['Scheduled exports','Faster exports','Custom columns'][i],description:'Finance workflow '+i,boardSlug:settings.boardSlugs[0],displayName:'Avery Morgan'},operator))
 const cards=await json(await call('/api/public/roadmap'))
 expect(cards).toHaveLength(2)
 expect(cards).toEqual(expect.arrayContaining([expect.objectContaining({status:'planned',title:'Scheduled exports'}),expect.objectContaining({status:'shipped',title:'Faster exports'})]))
 expect(JSON.stringify(cards)).not.toContain('Custom columns');expect(JSON.stringify(cards)).not.toContain('Staff only')
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM notification_intents').first('n')).toBe(0)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM request_status_updates').first('n')).toBe(0)
})
it('[ROAD-014 IMP-002 IMP-004] stale approval, private boards and later native roadmap edits refuse without deleting imported work',async()=>{
 const operator=await owner(),input=source('roadmap-conflict'),before=(await json(await call(root,undefined,operator))).settings
 const plan=await preview(input,operator)
 await json(await call(root,{...before,source:'approved_items'},operator,'PUT'))
 expect((await call(importPath+'/apply',{source:input,fingerprint:plan.fingerprint},operator)).status).toBe(409)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM boards').first('n')).toBe(0)
 const invalid=structuredClone(input);invalid.roadmap!.boardIds=['staff']
 expect((await call(importPath+'/preview',invalid,operator)).status).toBe(422)
 const job=await apply(input,operator),settings=(await json(await call(root,undefined,operator))).settings
 await json(await call(root,{...settings,shippedDays:30},operator,'PUT'))
 expect((await call(`${importPath}/jobs/${job.id}/undo`,{},operator)).status).toBe(409)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM requests').first('n')).toBe(3)
 expect((await json(await call(root,undefined,operator))).settings.shippedDays).toBe(30)
})
it('[ROAD-014 BASE-OPS-002] upgrades populated previous-head imports without changing their records and applies the new roadmap as a reviewed delta',async()=>{
 await reset()
 const migrations=inject('migrations') as {name:string;queries:string[]}[]
 await applyD1Migrations(env.DB,migrations.filter(m=>!m.name.startsWith('0079_')&&!m.name.startsWith('0095_')))
 const operator=await owner(),input=source('roadmap-upgrade'),previous=structuredClone(input);delete previous.roadmap
 await apply(previous,operator)
 const snapshot=async()=>Promise.all(['boards','requests','evidence_items','evidence_versions'].map(table=>env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`).all().then(result=>result.results)))
 const before=await snapshot()
 await applyD1Migrations(env.DB,migrations)
 expect(await snapshot()).toEqual(before)
 await applyD1Migrations(env.DB,migrations)
 expect(await snapshot()).toEqual(before)
 await apply(input,operator)
 expect(await snapshot()).toEqual(before)
 expect((await json(await call(root,undefined,operator))).settings.source).toBe('request_statuses')
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
