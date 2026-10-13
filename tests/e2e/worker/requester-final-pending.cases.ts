import { it,expect } from 'vitest'
import { boardGraph,person,env,call,opaqueToken,pauseBeforeBatch,digest } from './requester-final-fixture'
import { bindPendingRequesterActions,holdPendingRequesterAction,replayPendingRequesterAction } from '../../../src/core/features/requests/pending-actions'
it('[REQ-023] replacing a claimed held comment keeps its own identity and accepted replacement through older replay cleanup',async()=>{
 const f=await boardGraph(1),[r]=f.requests,who=await person(),token=opaqueToken(),now=new Date().toISOString(),emailHash=await digest(`${token}:${who.email}`),tokenHash=await digest(token)
 await bindPendingRequesterActions({binding:env.DB},token,emailHash,now)
 await holdPendingRequesterAction({binding:env.DB},token,{type:'comment',slug:r.slug,body:'First held body'},now)
 const old=await env.DB.prepare('SELECT id FROM requester_pending_actions').first<{id:string}>()
 let replacementId:string|undefined
 const db=pauseBeforeBatch(async()=>{
  expect((await env.DB.prepare('SELECT claimed_at FROM requester_pending_actions WHERE id=?').bind(old!.id).first<{claimed_at:string}>())!.claimed_at).not.toBeNull()
  const accepted=await call(`/api/public/requests/${r.slug}/comments`,{body:'Replacement held body'},{'X-Penny-Pending-Token':token})
  expect(accepted.status).toBe(202);expect(await accepted.json()).toMatchObject({actionHeld:true})
  replacementId=(await env.DB.prepare('SELECT id FROM requester_pending_actions').first<{id:string}>())!.id
  expect(replacementId).not.toBe(old!.id)
 })
 const identity={requesterId:who.id,verifiedEmail:who.email,displayName:'Requester'}
 expect(await replayPendingRequesterAction({binding:db},identity,tokenHash,emailHash,now)).toEqual({state:'replayed'})
 expect(await env.DB.prepare('SELECT id FROM requester_pending_actions').first()).toEqual({id:replacementId})
 expect(await replayPendingRequesterAction({binding:env.DB},identity,tokenHash,emailHash,now)).toEqual({state:'replayed'})
 expect((await env.DB.prepare('SELECT body FROM request_comments ORDER BY rowid').all()).results).toEqual([{body:'First held body'},{body:'Replacement held body'}])
 expect(await replayPendingRequesterAction({binding:env.DB},identity,tokenHash,emailHash,now)).toEqual({state:'not_requested'})
})
