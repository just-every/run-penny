import type {PennyRuntime} from '@/core/app/runtime'
import type {RequesterIdentity} from '../auth/requester'
import {requesterWrite} from '../requests/write-admission'
export const weeklyVotePermission=`p.grant_origin='vote_subscription' AND p.revoked_at IS NULL AND p.suppressed_at IS NULL`
export async function weeklySetting(db:D1Database){
 return Boolean(await db.prepare('SELECT 1 FROM penny_weekly_summary WHERE singleton=1 AND enabled=1').first())
}
export async function weeklyPreference(db:D1Database,identity:RequesterIdentity){
 const choice=await db.prepare(`SELECT c.subscribed,c.granted_at AS grantedAt,c.revoked_at,a.email,a.verification_epoch=c.verification_epoch AS currentEpoch
 FROM penny_weekly_choices c JOIN requester_addresses a ON a.id=c.address_id WHERE c.requester_id=?`).bind(identity.requesterId).first<{subscribed:number;grantedAt:string;revoked_at:string|null;currentEpoch:number;email:string}>()
 const vote=choice?null:await db.prepare(`SELECT p.granted_at AS grantedAt FROM requester_update_permissions p JOIN requester_addresses a ON a.id=p.requester_address_id
 WHERE p.requester_id=? AND a.email=? AND ${weeklyVotePermission} ORDER BY p.granted_at LIMIT 1`).bind(identity.requesterId,identity.verifiedEmail).first<{grantedAt:string}>()
 return {enabled:await weeklySetting(db),subscribed:choice?Boolean(choice.subscribed&&!choice.revoked_at&&choice.currentEpoch&&choice.email===identity.verifiedEmail):Boolean(vote),origin:choice?'choice':vote?'vote':'none',grantedAt:choice?.grantedAt??vote?.grantedAt??null}
}
export async function changeWeeklyPreference(runtime:PennyRuntime,identity:RequesterIdentity,subscribed:boolean){
 const db=runtime.database.binding,now=new Date().toISOString()
 await requesterWrite(runtime.database,identity,[db.prepare(`INSERT INTO penny_weekly_choices(requester_id,address_id,subscribed,verification_epoch,granted_at,revoked_at,created_at,updated_at)
 SELECT ?,id,?,verification_epoch,?,?,?,? FROM requester_addresses WHERE requester_id=? AND email=?
 ON CONFLICT(requester_id) DO UPDATE SET address_id=excluded.address_id,subscribed=excluded.subscribed,verification_epoch=excluded.verification_epoch,
 granted_at=CASE WHEN excluded.subscribed=1 AND (penny_weekly_choices.subscribed=0 OR penny_weekly_choices.revoked_at IS NOT NULL OR penny_weekly_choices.address_id!=excluded.address_id OR penny_weekly_choices.verification_epoch!=excluded.verification_epoch) THEN excluded.granted_at ELSE penny_weekly_choices.granted_at END,
 revoked_at=excluded.revoked_at,updated_at=excluded.updated_at`).bind(identity.requesterId,Number(subscribed),now,subscribed?null:now,now,now,identity.requesterId,identity.verifiedEmail)],
 {sql:subscribed?'EXISTS(SELECT 1 FROM penny_weekly_summary WHERE singleton=1 AND enabled=1)':'1',values:[]})
 return weeklyPreference(db,identity)
}
export function revokeWeeklyChoice(db:D1Database,requesterId:string,addressId:string,now:string){
 return db.prepare('UPDATE penny_weekly_choices SET subscribed=0,revoked_at=?,updated_at=? WHERE requester_id=? AND address_id=?').bind(now,now,requesterId,addressId)
}
