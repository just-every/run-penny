import type {Row} from '../data/archive'
import {NativeError} from '../auth/native-tokens'
import {businessInput,mailIdentityInput} from './mail-identity'
/** Provenance travels with product data; provider test receipts stay installation-owned. */
export function validateMailIdentityArchive(data:Record<string,Row[]>){
 const fail=()=>{throw new NativeError('invalid_mail_identity_archive',400)}
 for(const row of data.penny_mail_identity??[]){
  const business={companyName:row.company_name,postalAddress:row.postal_address}
  if(!businessInput.safeParse(business).success||!mailIdentityInput.pick({senderName:true,replyTo:true}).safeParse({senderName:row.sender_name,replyTo:row.reply_to}).success)fail()
  if(row.from_address!==null&&!mailIdentityInput.safeParse({...business,senderName:row.sender_name,fromAddress:row.from_address,replyTo:row.reply_to}).success)fail()
 }
 if(!(data.penny_mail_identity??[]).length&&((data.boards??[]).some(row=>row.vote_subscriptions===1)||(data.requester_update_permissions??[]).some(row=>row.grant_origin!=='explicit'&&row.revoked_at===null)))fail()
 for(const row of data.requester_update_permissions??[]){
  if(!['explicit','vote_subscription','author_subscription'].includes(String(row.grant_origin)))fail()
  if(row.grant_origin==='explicit')continue
  if(!row.board_id||!Number.isSafeInteger(row.setting_version)||Number(row.setting_version)<1||!row.granted_at)fail()
  if(row.source!==(row.grant_origin==='vote_subscription'?'vote':'submission'))fail()
 }
}
