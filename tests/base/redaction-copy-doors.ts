import {expect} from 'vitest'
import {env} from 'cloudflare:workers'
type Call=(path:string,body?:unknown,headers?:Record<string,string>,method?:string)=>Response|Promise<Response>
export async function prepareRedactionCopies(call:Call,operator:Record<string,string>,requester:Record<string,string>){
 const read=async<T>(response:Response|Promise<Response>,status=200):Promise<T>=>{const r=await response;expect(r.status,await r.clone().text()).toBe(status);return r.json() as Promise<T>}
 const phrase='Copied excerpt ACCOUNT-1234',request=await read<{id:string;slug:string}>(call('/api/operator/requests',{title:phrase,description:phrase,boardSlug:'feedback',evidenceIds:[]},operator),201)
 await read(call('/api/operator/moderation/'+request.slug,{verdict:'approved',title:phrase,description:phrase,boardSlug:'feedback',displayName:'Product team'},operator))
 await read(call('/api/operator/requests/'+request.slug+'/notes',{body:phrase},operator),201)
 const comment=await read<{id:string}>(call('/api/public/requests/'+request.slug+'/comments',{body:phrase},requester),201)
 await read(call('/api/operator/comments/'+comment.id+'/moderate',{verdict:'approved',publicAuthorDisplayName:'Synthetic commenter'},operator))
 await read(call('/api/public/comments/'+comment.id,{body:phrase+' edited'},requester,'PATCH'))
 const portal=await env.DB.prepare("SELECT id,slug FROM requests WHERE title='Synthetic portal capture'").first<{id:string;slug:string}>()
 await read(call('/api/operator/moderation/'+portal!.slug,{verdict:'rejected',reason:phrase,notifyAuthor:false},operator))
 await read(call('/api/public/requests/'+portal!.slug+'/appeals',{subjectType:'request',subjectId:portal!.id,body:phrase},requester),201)
 const actor=await env.DB.prepare('SELECT id FROM operators ORDER BY created_at LIMIT 1').first<string>('id')
 const decision=await read<{id:string}>(call('/api/operator/decisions',{question:'Synthetic redaction comparison',ownerOperatorId:actor},operator),201)
 const bet=await read<{id:string}>(call('/api/operator/decisions/'+decision.id+'/bets',{title:'Synthetic alternative',summary:'Synthetic internal comparison'},operator),201)
 await read(call('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Synthetic copy source',wording:phrase,observedAt:'2026-10-24T09:00:00Z',betLinks:[{id:bet.id,stance:'supporting'}]},operator),201)
 const commitment=await read<{itemId:string}>(call('/api/operator/decisions/'+decision.id+'/commit',{selectedCandidateBetId:bet.id,rationale:'Synthetic internal commitment',ownerOperatorId:actor,confidence:'medium',reviewAt:'2026-11-01',noViableAlternativeReason:'Synthetic comparison'},operator))
 await read(call('/api/operator/roadmap/'+commitment.itemId,{title:phrase,summary:phrase,targetWindow:'Future',deliveryNotes:phrase,accountImpact:phrase,ownerOperatorId:actor,confidence:'medium',decisionId:decision.id,candidateBetId:bet.id,publicTitle:null,publicSummary:null,evidenceIds:[]},operator,'PATCH'))
 return ['evidence_versions','evidence_items','requests','request_content_submissions','request_comments','request_comment_edits','request_notes','request_moderation_appeals','roadmap_items']
}
