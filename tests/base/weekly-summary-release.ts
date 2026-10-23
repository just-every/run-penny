import {call,env} from './support'
/** Prepare a real public release through the same operator routes as the workspace. */
export async function weeklyRelease(operator:Record<string,string>,requestId:string){
 const action=async(path:string,body:unknown,method='POST')=>{
  const response=await call(path,body,operator,method)
  if(!response.ok)throw Error(`Weekly release setup ${path}: ${response.status} ${await response.text()}`)
  return response.json() as Promise<Record<string,string>>
 }
 const actor=(await env.DB.prepare('SELECT id FROM operators LIMIT 1').first<string>('id'))!
 const decision=await action('/api/operator/decisions',{question:'How should scheduled exports reach finance?',ownerOperatorId:actor})
 const bet=await action(`/api/operator/decisions/${decision.id}/bets`,{title:'Scheduled exports',summary:'Prepare approved reporting exports.'})
 const evidence=await action('/api/operator/evidence',{sourceType:'interview',wording:'Finance needs an approved reporting export.',observedAt:new Date().toISOString()})
 await action(`/api/operator/evidence/${evidence.id}/links`,{target:'bet',targetId:bet.id,stance:'supporting'},'PUT')
 const item=await action(`/api/operator/decisions/${decision.id}/commit`,{selectedCandidateBetId:bet.id,rationale:'Exporting removes repeated manual preparation.',ownerOperatorId:actor,confidence:'medium',reviewAt:'2027-12-01',noViableAlternativeReason:'One bounded approach is ready for review.'})
 await action(`/api/operator/roadmap/${item.itemId}/approve`,{publicTitle:'Scheduled exports',publicSummary:'Approved reporting exports.',boardSlug:'regression',requestIds:[requestId]})
 await action(`/api/operator/roadmap/${item.itemId}/move`,{status:'shipped',reason:'Approved export is available.',idempotencyKey:crypto.randomUUID()})
 const tag=await action('/api/operator/catalog/tags',{name:'Reporting'})
 const release=await action('/api/operator/releases',{title:'Scheduled exports are available',body:'Public weekly release wording',releaseType:'improved',tagIds:[tag.id],publicationDate:new Date().toISOString().slice(0,10),setupUrl:'',targetIds:[item.itemId],authorOperatorId:actor})
 await action(`/api/operator/releases/${release.slug}/publish`,{})
 return release
}
