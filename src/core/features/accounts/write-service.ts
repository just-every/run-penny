import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import { audit,exists,validDate } from '../decisions/write-support'
export interface AccountInput {name:string;internalOwnerId:string|null;revenueCents?:number|null;renewalDate?:string|null;health?:string|null}
export async function saveAccount(db:D1Database,id:string|null,input:AccountInput,actor:string,now:string){
 await exists(db,'operators',input.internalOwnerId)
 if(input.renewalDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(input.renewalDate)||!validDate(input.renewalDate)))throw new MutationError(422,'Renewal date must be a valid calendar date.')
 if(id){
 await exists(db,'accounts',id)
 await db.batch([db.prepare('UPDATE accounts SET name=?,internal_owner_id=?,revenue_cents=?,renewal_date=?,health=?,updated_at=? WHERE id=?').bind(input.name,input.internalOwnerId,input.revenueCents??null,input.renewalDate??null,input.health??null,now,id),audit(db,actor,'account',id,'account.updated',now)])
 return {id}
 }
 const accountId=createUlid(),slug=`${input.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'account'}-${accountId.toLowerCase()}`
 await db.batch([db.prepare('INSERT INTO accounts(id,slug,name,internal_owner_id,revenue_cents,renewal_date,health,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(accountId,slug,input.name,input.internalOwnerId,input.revenueCents??null,input.renewalDate??null,input.health??null,now,now),audit(db,actor,'account',accountId,'account.created',now)])
 return {id:accountId,slug}
}
