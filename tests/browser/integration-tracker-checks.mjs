import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'

/** Both provider protocols enter the same native receipt transaction. */
export async function checkTrackerReceipts({runtime,action,subject,connectionId,secret,teamId,organizationId,externalId}) {
 const jira=await action('/api/operator/integrations/trackers/connections',{name:'Synthetic Jira receipt',provider:'jira',projectIdentity:'10200',siteOrigin:'https://synthetic-penny-1.atlassian.net',issueType:'10001',signingKey:secret})
 await action('/api/operator/integrations/trackers/links',{requestId:subject.id,connectionId:jira.id,externalId:'10042',url:'https://synthetic-penny-1.atlassian.net/browse/PEN-42'})
 const accepted=[]
 for(const provider of ['linear','jira']) {
  const id=provider==='linear'?connectionId:jira.id
  const payload=(updated,state,wrongIdentity=false)=>provider==='linear'
   ? {action:'update',type:'Issue',organizationId:wrongIdentity?'synthetic-penny-wrong-organization':organizationId,webhookTimestamp:Date.now(),data:{id:externalId,teamId,updatedAt:updated,state:{name:state}}}
   : {webhookEvent:'jira:issue_updated',issue:{id:'10042',fields:{project:{id:wrongIdentity?'99999':'10200'},updated,status:{name:state}}}}
  const wire=(body,delivery=crypto.randomUUID())=>{
   const raw=JSON.stringify(body),signature=createHmac('sha256',secret).update(raw).digest('hex')
   return {raw,headers:provider==='linear'?{'Linear-Signature':signature,'Linear-Delivery':delivery,'Linear-Event':'Issue'}:{'X-Hub-Signature':'sha256='+signature,'X-Atlassian-Webhook-Identifier':delivery}}
  }
  const post=(packet,raw=packet.raw)=>fetch(runtime.origin+'/api/integrations/trackers/'+id,{method:'POST',headers:packet.headers,body:raw})
  const snapshot=async()=>({link:await runtime.db.prepare('SELECT * FROM penny_tracker_links WHERE connection_id=?').bind(id).first(),receipts:(await runtime.db.prepare('SELECT * FROM penny_tracker_receipts WHERE connection_id=? ORDER BY delivery_id').bind(id).all()).results})
  const initial=await snapshot(),current=wire(payload('2026-10-09T13:30:00.000Z',`synthetic-penny-private-tracker-${provider}`))
  assert.equal((await post(current,current.raw+' ')).status,401,'[INT-006] provider signature binds the original bytes')
  assert.equal((await post(wire(payload('2026-10-09T13:30:00.000Z','Wrong identity',true)))).status,422,'[INT-006] configured provider identity is required')
  assert.deepEqual(await snapshot(),initial,'[INT-006] refused receipts change neither state nor history')
  assert.equal((await post(current)).status,200)
  const applied=await snapshot()
  assert.equal(applied.link.state,`synthetic-penny-private-tracker-${provider}`)
  const older=await post(wire(payload('2026-10-09T12:00:00.000Z','Older state')))
  assert.equal(older.status,200)
  assert.equal((await older.json()).disposition,'older')
  assert.equal((await snapshot()).link.state,applied.link.state,'[INT-006] source order prevents regression')
  assert.equal((await post(wire(payload('2026-10-09T13:30:00.000Z','Conflicting state')))).status,409,'[INT-006] equal-time conflicting state is refused')
  const beforeFailure=await snapshot(),next=wire(payload('2026-10-09T14:30:00.000Z','Uncommitted state'))
  await runtime.db.exec("CREATE TRIGGER synthetic_penny_tracker_failure BEFORE INSERT ON penny_tracker_receipts BEGIN SELECT RAISE(ABORT,'synthetic receipt failure'); END")
  try{assert.equal((await post(next)).status,503)}finally{await runtime.db.exec('DROP TRIGGER synthetic_penny_tracker_failure')}
  assert.deepEqual(await snapshot(),beforeFailure,'[INT-006] state and receipt commit atomically')
  const authority=await runtime.db.prepare('SELECT native_operator_id,operator_version FROM penny_tracker_connections WHERE id=?').bind(id).first()
  await runtime.db.prepare('UPDATE oa_operators SET version=version+1 WHERE id=?').bind(authority.native_operator_id).run()
  try{assert.equal((await post(next)).status,409,'[INT-006] stale native configuration cannot receive')}
  finally{await runtime.db.prepare('UPDATE oa_operators SET version=? WHERE id=?').bind(authority.operator_version,authority.native_operator_id).run()}
  assert.deepEqual(await snapshot(),beforeFailure)
  accepted.push({post,current,snapshot,before:beforeFailure})
 }
 await runtime.restart()
 for(const {post,current,snapshot,before} of accepted) {
  assert.equal((await post(current)).status,200,'[INT-006] replay identity survives restart')
  assert.deepEqual(await snapshot(),before,'[INT-006] replay changes no state or receipt')
 }
 for(const path of [`/api/public/requests/${subject.slug}`,`/portal/feedback/${subject.slug}`]) {
  const response=await fetch(runtime.origin+path)
  assert.equal(response.status,200,'[INT-006] privacy is checked on a published request')
  assert.doesNotMatch(await response.text(),/synthetic-penny-private-tracker/,'[INT-006] provider state remains private in API, SSR and hydration')
 }
 assert.equal(await runtime.db.prepare('SELECT count(*) n FROM request_status_updates').first('n'),0,'[INT-006] receiving state never chooses Penny status or publishes an update')
}
