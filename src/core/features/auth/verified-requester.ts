import type {PennyRuntime} from '@/core/app/runtime'
import {createUlid} from '@/core/shared/ulid'
import {digest,NativeError,opaqueToken} from './native-tokens'
import {authenticateNativeRequester} from './native-service'
import {replayPendingRequesterAction} from '../requests/pending-actions'
export type VerifiedAddress={email:string;displayName:string|null;pendingHash:string|null;pendingEmailHash:string|null}
/** Both email links and OAuth enter here only with a single-use transactional
 * claim. Neither path creates operator authority or email permission. */
export async function mintVerifiedRequester(runtime:PennyRuntime,link:VerifiedAddress,gate:string,parameters:(string|number|null)[],claim:D1PreparedStatement){
 const db=runtime.database.binding,now=new Date().toISOString(),requesterId=createUlid(),sessionToken=opaqueToken(),sessionHash=await digest(sessionToken),expires=new Date(Date.now()+30*86400000).toISOString()
 const results=await db.batch([
  claim,
  db.prepare(`INSERT INTO requesters(id,display_name,created_at,updated_at) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM requester_addresses WHERE email=?) AND ${gate}`).bind(requesterId,link.displayName,now,now,link.email,...parameters),
  db.prepare(`INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) SELECT ?,?,?,?,?,? WHERE ${gate} ON CONFLICT(email) DO UPDATE SET verified_at=excluded.verified_at,suppressed_at=NULL,updated_at=excluded.updated_at`).bind(createUlid(),requesterId,link.email,now,now,now,...parameters),
  db.prepare(`INSERT INTO native_requester_sessions(id,requester_id,address_id,token_hash,expires_at,last_used_at,created_at,updated_at) SELECT ?,requester_id,id,?,?,?,?,? FROM requester_addresses WHERE email=? AND ${gate}`).bind(createUlid(),sessionHash,expires,now,now,now,link.email,...parameters),
 ])
 if(results[0].results.length!==1)throw new NativeError('verification_claim_refused',401)
 let rejectedPendingActions=0
 if(link.pendingHash&&link.pendingEmailHash){
  const identity=await authenticateNativeRequester(runtime,sessionToken)
  let result;do{result=await replayPendingRequesterAction(runtime.database,{requesterId:identity.id,displayName:identity.displayName,verifiedEmail:identity.email,addressId:identity.addressId,sessionId:identity.sessionId},link.pendingHash,link.pendingEmailHash,now);if(result.state==='rejected')rejectedPendingActions++}while(result.state!=='not_requested')
 }
 return {token:sessionToken,displayName:link.displayName??link.email.split('@')[0],rejectedPendingActions}
}
