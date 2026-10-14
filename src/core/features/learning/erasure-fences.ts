import {digest,NativeError} from '../auth/native-tokens'

/** Canonical provider identities survive duplicate connections and new grants. */
export const sourceEvent=(provider:string,installation:string|null,target:string)=>`${provider}:${installation}:${target}`
export const sourcePerson=(provider:string,installation:string|null,person:string)=>`${provider}:${installation}:person:${person}`
export async function assertSourceTargets(db:D1Database,provider:string,installation:string|null,targets:string[]){
 for(const target of targets){
  const eventHash=await digest(sourceEvent(provider,installation,target))
  const personHash=target.startsWith('contacts/')?await digest(sourcePerson(provider,installation,target.slice(9))):''
  if(await db.prepare('SELECT 1 FROM learning_erased_events WHERE event_hash=? UNION ALL SELECT 1 FROM learning_erased_people WHERE person_hash=? LIMIT 1').bind(eventHash,personHash).first())throw new NativeError('learning_source_erased',409)
 }
}
