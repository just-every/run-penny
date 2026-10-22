import assert from 'node:assert/strict'

/** Signed notes enter through the native webhook door, with no app response doubles. */
export async function checkReceiver({runtime,protocol,destinationId,subject}) {
 const path=runtime.origin+'/api/integrations/webhooks/'+destinationId
 const prepare=id=>protocol.prepare({id,tenant:'penny-inbound',destinationId,event:'request.note',protocol:'webhook',body:JSON.stringify({requestId:subject.id,note:'synthetic-penny-private-note'})},Date.now())
 const post=(wire,body=wire.body)=>fetch(path,{method:'POST',headers:wire.headers,body})
 const rows=async()=>({
  notes:(await runtime.db.prepare('SELECT * FROM request_notes ORDER BY id').all()).results,
  receipts:(await runtime.db.prepare('SELECT * FROM penny_integration_receipts ORDER BY id').all()).results,
  replays:(await runtime.db.prepare('SELECT * FROM integration_replays ORDER BY id').all()).results,
 })
 const unchanged=await rows(),wire=await prepare('synthetic-penny-receiver-1')
 for(const body of [wire.body+' ','{'])assert.equal((await post(wire,body)).status,401,'[INT-004] original signature rejects changed or malformed bytes before parsing')
 assert.equal((await post(wire,'x'.repeat(65536))).status,413,'[INT-004] oversized input is refused before a note is stored')
 assert.deepEqual(await rows(),unchanged,'[INT-004] rejected bytes create neither note nor receipt')
 await runtime.db.exec("CREATE TRIGGER synthetic_penny_note_failure BEFORE INSERT ON request_notes BEGIN SELECT RAISE(ABORT,'synthetic note failure'); END")
 try{assert.equal((await post(wire)).status,503,'[INT-004] a failed note insert refuses the whole receipt')}
 finally{await runtime.db.exec('DROP TRIGGER synthetic_penny_note_failure')}
 assert.deepEqual(await rows(),unchanged,'[INT-004] note and processed replay receipt are atomic')
 const identities=()=>runtime.db.prepare('SELECT (SELECT count(*) FROM requesters) people,(SELECT count(*) FROM native_requester_sessions) requesters,(SELECT count(*) FROM oa_sessions) operators').first()
 const identityBefore=await identities()
 const requestBefore=await runtime.db.prepare('SELECT * FROM requests WHERE id=?').bind(subject.id).first()
 const permissionsBefore=(await runtime.db.prepare('SELECT * FROM requester_update_permissions ORDER BY id').all()).results
 const accepted=await post(wire)
 assert.equal(accepted.status,200)
 assert.equal(accepted.headers.has('set-cookie'),false,'[INT-004] a signed note issues no identity cookie')
 assert.equal(Object.hasOwn(await accepted.json(),'token'),false,'[INT-004] a signed note issues no bearer')
 await runtime.restart()
 assert.equal((await post(wire)).status,200,'[INT-004] restart retains receipt identity')
 const after=await rows()
 assert.equal(after.notes.length,unchanged.notes.length+1)
 assert.equal(after.receipts.length,unchanged.receipts.length+1)
 assert.equal(after.replays.length,unchanged.replays.length+1)
 const note=after.notes.find(row=>row.body==='synthetic-penny-private-note')
 assert.equal(note.request_id,subject.id)
 assert.equal(after.receipts.find(row=>row.id==='synthetic-penny-receiver-1').note_id,note.id)
 assert.deepEqual(await runtime.db.prepare('SELECT * FROM requests WHERE id=?').bind(subject.id).first(),requestBefore,'[INT-004] receiving a note never publishes or changes a request')
 assert.deepEqual(await identities(),identityBefore,'[INT-004] receiving a note creates no requester or operator identity')
 assert.deepEqual((await runtime.db.prepare('SELECT * FROM requester_update_permissions ORDER BY id').all()).results,permissionsBefore,'[INT-004] receiving a note grants no consent')
 const authority=await runtime.db.prepare('SELECT native_operator_id,operator_version FROM penny_integration_destinations WHERE id=?').bind(destinationId).first()
 await runtime.db.prepare('UPDATE oa_operators SET version=version+1 WHERE id=?').bind(authority.native_operator_id).run()
 try{assert.equal((await post(await prepare('synthetic-penny-receiver-2'))).status,409,'[INT-004] stale configuration authority refuses a signed note')}
 finally{await runtime.db.prepare('UPDATE oa_operators SET version=? WHERE id=?').bind(authority.operator_version,authority.native_operator_id).run()}
 assert.deepEqual(await rows(),after,'[INT-004] current authority fences note and receipt together')
}
