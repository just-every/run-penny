import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,afterEach,expect,inject,it,vi} from 'vitest'
import {Buffer} from 'node:buffer'
import {call,env,owner,mockMail} from './support'
import {apply,complete,importPath,preview} from './feedback-import-fixture'
import {stableFeedbackId} from '@/core/features/imports/mapping-support'
import type {SavedFeedbackInput} from '@/core/features/imports/types'

beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()})
afterEach(()=>vi.restoreAllMocks())
const created='2024-07-08T09:10:11Z'
function source(namespace:string):SavedFeedbackInput{
 return {namespace,statuses:{Researching:'under_review',Building:'in_progress'},internalStatuses:{Researching:{name:'Researching',showPublicLabel:false},Building:{name:'Building',showPublicLabel:true}},boards:[{id:'finance',name:'Finance',isPrivate:false,created}],files:[{name:'posts.json',kind:'posts',version:'v1',base64:Buffer.from(JSON.stringify({posts:[0,1,2].map(i=>({id:'post-'+i,title:'Finance workflow '+i,details:'Keep every finance export available.',status:i===2?'Building':'Researching',board:{id:'finance'},author:{id:'customer',name:'Avery Morgan',created},created}))})).toString('base64')}]}
}
async function json(response:Response,status=200):Promise<any>{expect(response.status,await response.clone().text()).toBe(status);return response.json()}
it('[PRIO-002 IMP-002 IMP-004] imports reviewed Canny custom statuses once, maps public labels, refuses changed approval and reverses unchanged definitions and requests',async()=>{
 const operator=await owner(),input=source('status-custody')
 // [PRIO-002] Refuse an unused mapping before applying this history.
 const invalid=structuredClone(input);invalid.internalStatuses!.Unknown={name:'Unknown',showPublicLabel:false}
 expect((await call(importPath+'/preview',invalid,operator)).status).toBe(422)
 const plan=await preview(input,operator),changed=structuredClone(input)
 changed.internalStatuses!.Researching.name='Needs information'
 expect((await call(importPath+'/apply',{source:changed,fingerprint:plan.fingerprint},operator)).status).toBe(409)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM request_internal_statuses').first('n')).toBe(0)
 const job=await apply(input,operator)
 expect((await apply(input,operator)).id).toBe(job.id)
 const settings=await json(await call('/api/operator/settings/request-statuses',undefined,operator))
 expect(settings.statuses).toHaveLength(2)
 expect(settings.statuses).toEqual(expect.arrayContaining([expect.objectContaining({name:'Researching',publicStatus:'under_review',showPublicLabel:false}),expect.objectContaining({name:'Building',publicStatus:'in_progress',showPublicLabel:true})]))
 const status=stableFeedbackId(input.namespace,'statuses','Researching')
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM requests WHERE internal_status_id=?').bind(status).first('n')).toBe(2)
 const receipt=await json(await call(`${importPath}/jobs/${job.id}/receipt`,undefined,operator))
 expect(receipt.destinations).toEqual(expect.arrayContaining([expect.objectContaining({table:'request_internal_statuses',created:2})]));expect(receipt.effects).toEqual({mail:0,notifications:0})
 await complete(await json(await call(`${importPath}/jobs/${job.id}/undo`,{},operator)),operator)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM requests').first('n')).toBe(0)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM request_internal_statuses').first('n')).toBe(0)
 const reapplied=await apply(input,operator)
 // [IMP-004] A native edit to the same imported definition prevents undo.
 await json(await call('/api/operator/settings/request-statuses/'+status,{name:'Customer research'},operator,'PATCH'))
 expect((await call(`${importPath}/jobs/${reapplied.id}/undo`,{},operator)).status).toBe(409)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM requests').first('n')).toBe(3)
 expect(await env.DB.prepare('SELECT name FROM request_internal_statuses WHERE id=?').bind(status).first('name')).toBe('Customer research')
 const boardSlug='import-'+stableFeedbackId(input.namespace,'boards','finance').toLowerCase()
 for(const i of [0,2]){
  const slug='feedback-'+stableFeedbackId(input.namespace,'posts','post-'+i).toLowerCase()
  await json(await call('/api/operator/moderation/'+slug,{verdict:'approved',title:'Finance workflow '+i,description:'Keep every finance export available.',boardSlug,displayName:'Avery Morgan'},operator))
  const detail=await json(await call('/api/public/requests/'+slug))
  expect(detail.status).toBe(i===0?'under_review':'in_progress')
  expect(JSON.stringify(detail)).not.toContain('Researching');expect(JSON.stringify(detail)).not.toContain('Customer research')
  if(i===2)expect(detail.statusLabel).toBe('Building')
 }
 await json(await call('/api/operator/settings/request-statuses/'+status,{publicStatus:'planned'},operator,'PATCH'))
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM requests WHERE internal_status_id=? AND public_state=?').bind(status,'planned').first('n')).toBe(2)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM request_status_updates').first('n')).toBe(0)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM notification_intents').first('n')).toBe(0)


})
