import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,afterEach,expect,inject,it,vi} from 'vitest'
import {Buffer} from 'node:buffer'
import {call,env,owner,requester,mockMail} from './support'
import {apply,complete,feedbackFixture,importPath,preview} from './feedback-import-fixture'
import {stableFeedbackId} from '@/core/features/imports/mapping-support'
import type {SavedFeedbackInput} from '@/core/features/imports/types'
import {defaultFeedbackBoardPolicy} from '@/core/features/imports/board-policy'

beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()})
afterEach(()=>vi.restoreAllMocks())
async function json<T=any>(response:Response,status=200):Promise<T>{expect(response.status,await response.clone().text()).toBe(status);return response.json()}
const mappedPolicy={postingPolicy:'operators' as const,commentsAllowed:true,showVoteCounts:false,showVoters:true,anonymousRequesters:true}

it('[REQ-040 IMP-002] reviewed Canny board mappings preserve posting, comments, hidden votes, voter disclosure and anonymity without inventing source fields or email',async()=>{
 const operator=await owner(),source=feedbackFixture('board-policy')
 source.boardPolicies={'public-board':mappedPolicy,'internal-board':{...defaultFeedbackBoardPolicy,commentsAllowed:false}}
 const plan=await preview(source,operator),changed=structuredClone(source)
 changed.boardPolicies!['public-board'].showVoteCounts=true
 expect((await call(importPath+'/apply',{source:changed,fingerprint:plan.fingerprint},operator)).status).toBe(409)
 expect(await env.DB.prepare('SELECT COUNT(*) FROM boards').first('COUNT(*)')).toBe(0)
 const job=await apply(source,operator),id=stableFeedbackId(source.namespace,'boards','public-board'),boardSlug='import-'+id.toLowerCase(),slug='feedback-'+stableFeedbackId(source.namespace,'posts','post-0').toLowerCase()
 expect(await env.DB.prepare('SELECT posting_policy,comments_allowed,show_vote_counts,show_voters,anonymous_requesters FROM boards WHERE id=?').bind(id).first()).toEqual({posting_policy:'operators',comments_allowed:1,show_vote_counts:0,show_voters:1,anonymous_requesters:1})
 expect((await apply(source,operator)).id).toBe(job.id)
 const receipt=await json(await call(importPath+'/jobs/'+job.id+'/receipt',undefined,operator));expect(receipt.effects).toEqual({mail:0,notifications:0})
 for(const table of ['requester_addresses','requester_update_permissions','notification_intents','notification_outbox'])expect(await env.DB.prepare(`SELECT COUNT(*) FROM ${table}`).first('COUNT(*)')).toBe(0)
 const originals=await json(await call(importPath+'/jobs/'+job.id+'/originals',undefined,operator))
 const mapping=originals.find((item:any)=>item.name==='penny-mapping.json')
 expect(JSON.parse(Buffer.from(mapping.original.base64,'base64').toString()).boardPolicies).toEqual(source.boardPolicies)
 await json(await call(`/api/operator/moderation/${slug}`,{verdict:'approved',title:'Schedule monthly finance exports',description:'Make exports available before monthly finance review.',boardSlug,displayName:'Source customer'},operator))
 const person=await requester('Avery Morgan')
 const submit={title:'A new finance request',description:'Our finance team needs this.',boardSlug,idempotencyKey:crypto.randomUUID()}
 expect((await call('/api/public/requests',submit,person)).status).toBe(403)
 expect((await call('/api/public/requests',submit)).status).toBe(403)
 expect((await call(`/api/public/requests/${slug}/vote`,{},person)).status).toBe(204)
 const comment=await json(await call(`/api/public/requests/${slug}/comments`,{body:'Keep the original currency in exports.'},person),201)
 await json(await call(`/api/operator/comments/${comment.id}/moderate`,{verdict:'approved',publicAuthorDisplayName:'Avery Morgan'},operator))
 const detail=await json(await call(`/api/public/requests/${slug}`))
 expect(detail).not.toHaveProperty('voteCount');expect(detail.authorDisplayName).toBe('Anonymous')
 expect(detail.comments).toEqual(expect.arrayContaining([expect.objectContaining({body:'Keep the original currency in exports.',author:expect.objectContaining({displayName:'Anonymous'})})]))
 expect(detail.voters.length).toBeGreaterThan(0);expect(detail.voters.every((v:any)=>v.displayName==='Anonymous')).toBe(true)
 expect(JSON.stringify(detail)).not.toContain('Avery Morgan');expect(JSON.stringify(detail)).not.toContain('Source customer')
 const board=(await json(await call('/api/public/boards'))).find((b:any)=>b.slug===boardSlug)
 expect(board).toMatchObject({postingPolicy:'operators',commentsAllowed:true,showVoteCounts:false,showVoters:true,anonymousRequesters:true})
 expect((await json(await call('/api/public/requests?board='+boardSlug))).every((r:any)=>!('voteCount' in r))).toBe(true)
 expect(await json(await call(`/api/operator/requests/${slug}/context`,undefined,operator))).toMatchObject({voters:expect.arrayContaining([expect.objectContaining({displayName:'Avery Morgan'})])})
 await json(await call(`/api/operator/boards/${boardSlug}`,{commentsAllowed:false},operator,'PATCH'))
 expect((await call(`/api/public/requests/${slug}/comments`,{body:'Must be refused.'},person)).status).toBe(403)
})

it('[REQ-040 IMP-004] mapped boards replay, undo and reapply; later native policy changes refuse reversal and invalid mappings create nothing',async()=>{
 const operator=await owner(),source:SavedFeedbackInput={namespace:'board-policy-reversal',statuses:{},files:[{name:'boards.json',kind:'boards',version:'v1',base64:Buffer.from(JSON.stringify({boards:[{id:'board',name:'Finance',isPrivate:false,created:'2024-07-08T09:10:11Z'}]})).toString('base64')}],boardPolicies:{board:mappedPolicy}}
 for(const [policies,status] of [[{missing:mappedPolicy},422],[{board:{...mappedPolicy,showVoteCounts:'false'}},400]] as const){
  expect((await call(importPath+'/preview',{...source,boardPolicies:policies},operator)).status).toBe(status)
  expect(await env.DB.prepare('SELECT COUNT(*) FROM boards').first('COUNT(*)')).toBe(0)
 }
 const job=await apply(source,operator)
 await complete(await json(await call(`${importPath}/jobs/${job.id}/undo`,{},operator)),operator)
 expect(await env.DB.prepare('SELECT COUNT(*) FROM boards').first('COUNT(*)')).toBe(0)
 const reapplied=await apply(source,operator),slug='import-'+stableFeedbackId(source.namespace,'boards','board').toLowerCase()
 expect(reapplied.id).not.toBe(job.id)
 await json(await call('/api/operator/boards/'+slug,{showVoteCounts:true},operator,'PATCH'))
 const undo=await call(`${importPath}/jobs/${reapplied.id}/undo`,{},operator)
 expect(undo.status).toBe(409)
 expect(await env.DB.prepare('SELECT show_vote_counts FROM boards WHERE slug=?').bind(slug).first('show_vote_counts')).toBe(1)
 expect(await env.DB.prepare('SELECT COUNT(*) FROM boards').first('COUNT(*)')).toBe(1)
})
