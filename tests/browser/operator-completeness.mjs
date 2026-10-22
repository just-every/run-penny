import {reviewRequesterPrivacy} from './operator-completeness-requester.mjs'
import {seedCompleteness} from './operator-completeness-data.mjs'
import {invitePeer,revokePeer,removeInitialOwner,localProofBindings} from './operator-completeness-auth.mjs'
import {reviewPrivateSearch,reviewDurableLists} from './operator-completeness-read.mjs'
import {reviewCustomFields} from './operator-completeness-fields.mjs'
import {reviewRejectionNotices} from './operator-completeness-notices.mjs'
import {reviewFrameOrigins,reviewPublicRate,reviewDestructionAudit} from './operator-completeness-security.mjs'
export async function reviewOperatorCompleteness(options) {
 const {runtime,page}=options,origin=runtime.origin,db=runtime.db
 await seedCompleteness(db)
 const peerState=await invitePeer({...options,origin})
 try {
  // Miniflare replaces its D1 stub on configure; each phase must use the current binding.
  const shared={...options,origin,get db(){return runtime.db},peer:peerState.peer}
  await reviewPrivateSearch(shared)
  await reviewDurableLists(shared)
  await reviewCustomFields(shared)
  await reviewRequesterPrivacy(shared)
  await reviewRejectionNotices(shared)
  await reviewFrameOrigins(shared)
  await reviewDestructionAudit(shared)
  await revokePeer({...shared,peerState})
  await reviewPublicRate(shared)
  await runtime.configure(localProofBindings)
  const successor=await invitePeer({...options,origin,email:'proof-successor@example.test'})
  try{await removeInitialOwner({...shared,successor})}finally{await successor.close()}
 }finally{await peerState.close()}
}

/** DATA-004's existing entity matrix, without unrelated account-management phases. */
export async function reviewOperatorFields(options) {
 const {runtime,page}=options,origin=runtime.origin
 await seedCompleteness(runtime.db)
 const peerState=await invitePeer({...options,origin})
 try {
  await reviewCustomFields({...options,origin,get db(){return runtime.db},peer:peerState.peer})
 } finally {await peerState.close()}
}
