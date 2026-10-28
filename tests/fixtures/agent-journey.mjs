/** Actual delayed effects through the same typed tools, after native customer
 * verification/follow consent. Only the CLI's paid mail boundary is simulated. */
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
export default async function journey({tool,mail}){
 async function call(name,args={}){const answer=await tool('penny.'+name,{...args,idempotency_key:randomUUID()});assert.equal(answer.status,200);assert.ok(answer.result&&!answer.result.isError&&answer.result.resultType!=='input_required',name);return answer.result.structuredContent}
 const found=await call('search.records',{entity:'requests',q:'Verifier customer delivery consent'}),request=found.items[0]
 assert.ok(request?.slug)
 await call('requests.set_status',{slug:request.slug,update:{status:'under_review',body:'The delivery assistant checked the retained delivery evidence.'}})
 const delivery=(await call('deliveries.prepare',{slug:request.slug})).items[0]
 assert.ok(delivery?.id)
 const snapshot=await call('workspace.snapshot'),publication=snapshot.penny_publication_schedules.find(row=>row.state==='scheduled')
 assert.ok(publication?.id)
 const due=Math.max(Date.parse(delivery.availableAt),Date.parse(publication.scheduled_at))
 assert.ok(Number.isFinite(due),'Native delivery and publication expose their due time')
 while(Date.now()<due)await new Promise(resolve=>setTimeout(resolve,Math.min(1000,due-Date.now())))
 const delivered=await call('deliveries.dispatch',{kind:'request',id:delivery.id})
 assert.equal(delivered.state,'accepted','The native provider admission must actually settle')
 const captured=mail.read({limit:20})
 assert.ok(captured.some(message=>message.text.includes(' for ')&&message.text.includes('delivery evidence')),'Actual outbound content names agent for sponsor')
 await call('publications.execute',{id:publication.id})
 const after=await call('workspace.snapshot'),settled=after.penny_publication_schedules.find(row=>row.id===publication.id)
 assert.equal(settled.state,'published')
 const release=after.releases.find(row=>row.id===publication.release_id)
 assert.equal(release.state,'published')
 const publicRelease=await call('releases.public',{slug:release.slug})
 assert.ok(JSON.stringify(publicRelease).includes(' for '),'Native release readback retains the agent preparer')
}
