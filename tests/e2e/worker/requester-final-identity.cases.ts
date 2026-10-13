import { it,expect } from 'vitest'
import { boardGraph,person,env,call,auth,pauseBeforeBatch } from './requester-final-fixture'
import { RequestWriteRepository } from '../../../src/core/features/requests/write-repository'
import { RequestOperatorRepository } from '../../../src/core/features/requests/operator-repository'
import { submitNativeRequest } from '../../../src/core/features/requests/native-submission'
for(const action of ['vote','follow','comment','submit','edit','withdraw','unvote','unfollow','mute','comment-edit','appeal'] as const)
it(`[REQ-002 REQ-024] paused ${action} cannot write a retired identity or address after an identity merge`,async()=>{
 const f=await boardGraph(1),[r]=f.requests,source=f.owner,target=await person(),now=new Date().toISOString()
 const address=await env.DB.prepare('SELECT id FROM requester_addresses WHERE requester_id=?').bind(source.id).first<{id:string}>()
 const session=await env.DB.prepare('SELECT id FROM native_requester_sessions WHERE requester_id=?').bind(source.id).first<{id:string}>()
 const identity={requesterId:source.id,verifiedEmail:source.email,displayName:'Source',addressId:address!.id,sessionId:session!.id}
 const original=new RequestWriteRepository({binding:env.DB})
 await original.vote(identity,r.slug,true,now)
 const comment=await original.comment(identity,r.slug,'Original comment',now)
 if(action==='appeal')await env.DB.prepare("UPDATE request_comments SET moderation_state='rejected' WHERE id=?").bind(comment.id).run()
 const db=pauseBeforeBatch(()=>new RequestOperatorRepository({binding:env.DB}).mergeRequesters(source.id,target.id,f.operator,now))
 const repo=new RequestWriteRepository({binding:db})
 const operation=()=>{
  switch(action){
   case 'vote':return repo.vote(identity,r.slug,true,now)
   case 'follow':return repo.follow(identity,r.slug,now)
   case 'comment':return repo.comment(identity,r.slug,'Late comment',now)
   case 'submit':return submitNativeRequest({binding:db},{id:source.id,addressId:address!.id,email:source.email,displayName:'Source',sessionId:session!.id},{title:'Late submission',description:'Late description',boardSlug:f.board,idempotencyKey:crypto.randomUUID(),emailUpdates:true})
   case 'edit':return repo.editOwnRequest(identity,r.slug,{title:'Late edit',description:'Late description',proposedSolution:null,impactStatement:null},now)
   case 'withdraw':return repo.withdraw(identity,r.slug,now)
   case 'unvote':return repo.removeVote(identity,r.slug)
   case 'unfollow':return repo.unfollow(identity,r.slug)
   case 'mute':return repo.setFollowMute(identity,r.slug,true,now)
   case 'comment-edit':return repo.editOwnComment(identity,comment.id,'Late edit',now)
   case 'appeal':return repo.appeal(identity,r.slug,'comment',comment.id,'Late appeal',now)
  }
 }
 await expect(operation()).rejects.toMatchObject({status:409,code:'requester_action_changed'})
 expect(await env.DB.prepare('SELECT requester_id FROM native_requester_sessions WHERE id=?').bind(session!.id).first()).toEqual({requester_id:target.id})
 for(const table of ['request_vote_contributions','request_follow_contributions','request_comments','request_content_submissions','request_comment_edits','request_moderation_appeals','requester_update_permissions'])
  expect((await env.DB.prepare(`SELECT * FROM ${table} WHERE requester_id=?`).bind(source.id).all()).results,table).toEqual([])
 expect((await env.DB.prepare('SELECT * FROM requester_update_permissions p JOIN requester_addresses a ON a.id=p.requester_address_id WHERE p.requester_id!=a.requester_id').all()).results).toEqual([])
 expect((await call(`/api/public/requests/${r.slug}/vote`,{emailUpdates:true},auth(source.token))).status).toBe(204)
 expect((await env.DB.prepare('SELECT requester_id FROM request_votes WHERE request_id=?').bind(r.id).all()).results).toEqual([{requester_id:target.id}])
 expect((await env.DB.prepare('SELECT * FROM requester_write_guards').all()).results).toEqual([])
})
for(const changed of ['revoked-session','expired-session','blocked','declined','internal'] as const)
it(`[REQ-006 REQ-017 REQ-022] ${changed} is rechecked in the action transaction`,async()=>{
 const f=await boardGraph(1),[r]=f.requests,who=await person(),now=new Date().toISOString()
 const session=await env.DB.prepare('SELECT id,address_id FROM native_requester_sessions WHERE requester_id=?').bind(who.id).first<{id:string;address_id:string}>()
 const db=pauseBeforeBatch(async()=>{
  if(changed==='revoked-session')await env.DB.prepare('UPDATE native_requester_sessions SET revoked_at=? WHERE id=?').bind(now,session!.id).run()
  if(changed==='expired-session')await env.DB.prepare("UPDATE native_requester_sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").bind(session!.id).run()
  if(changed==='blocked')await env.DB.prepare('UPDATE requesters SET blocked_at=? WHERE id=?').bind(now,who.id).run()
  if(changed==='declined')await env.DB.prepare("UPDATE requests SET public_state='declined' WHERE id=?").bind(r.id).run()
  if(changed==='internal')await env.DB.prepare("UPDATE boards SET visibility='internal'").run()
 })
 await expect(new RequestWriteRepository({binding:db}).vote({requesterId:who.id,verifiedEmail:who.email,displayName:'Voter',addressId:session!.address_id,sessionId:session!.id},r.slug,true,now)).rejects.toMatchObject({status:409})
 expect((await env.DB.prepare('SELECT * FROM request_vote_contributions').all()).results).toEqual([])
 expect((await env.DB.prepare('SELECT * FROM requester_update_permissions').all()).results).toEqual([])
})
it('[REQ-010 REQ-024] idempotent unfollow still refuses an already-retired identity',async()=>{
 const f=await boardGraph(1),[r]=f.requests,target=await person(),identity={requesterId:f.owner.id,verifiedEmail:f.owner.email,displayName:'Prior identity'}
 await new RequestOperatorRepository({binding:env.DB}).mergeRequesters(f.owner.id,target.id,f.operator,new Date().toISOString())
 await expect(new RequestWriteRepository({binding:env.DB}).unfollow(identity,r.slug)).rejects.toMatchObject({code:'requester_action_changed'})
})
