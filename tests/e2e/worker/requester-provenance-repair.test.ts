import { describe,it,expect } from 'vitest'
import { repairDatabase,boardGraph,person,change,merge,unmerge,env,call,auth,graphSnapshot,app,bindings } from './requester-repair-fixture'
repairDatabase()

it('[F01 REQ-009/010] unmerge never restores revoked permission, including a later canonical re-follow',async()=>{
  const f=await boardGraph(2),[a,b]=f.requests,who=await person()
  await change(a.slug,'follow',who.token);await merge(a.slug,b.slug,f.headers)
  await change(b.slug,'follow',who.token,undefined,'DELETE')
  expect((await env.DB.prepare('SELECT id FROM requester_update_permissions WHERE requester_id=? AND revoked_at IS NULL').bind(who.id).all()).results).toHaveLength(0)
  await change(b.slug,'follow',who.token)
  await unmerge(a.slug,f.headers)
  expect((await env.DB.prepare('SELECT request_id FROM request_follows WHERE requester_id=?').bind(who.id).all()).results).toEqual([{request_id:b.id}])
  expect((await env.DB.prepare('SELECT request_id FROM requester_update_permissions WHERE requester_id=? AND revoked_at IS NULL').bind(who.id).all()).results).toEqual([{request_id:b.id}])
})

for(const order of ['inner-first','outer-first'] as const)it(`[F02 REQ-008/009] ${order} chained reversal preserves overlapping and new direct contributions`,async()=>{
  const f=await boardGraph(4),[a,b,c,d]=f.requests,onlyA=await person(),overlap=await person(),later=await person()
  await change(a.slug,'vote',onlyA.token);await change(a.slug,'follow',onlyA.token)
  for(const r of [a,b,d])await change(r.slug,'vote',overlap.token,{emailUpdates:true})
  await merge(a.slug,b.slug,f.headers);await merge(d.slug,b.slug,f.headers);await merge(b.slug,c.slug,f.headers)
  await change(c.slug,'vote',later.token,{emailUpdates:true})
  // A fresh canonical action by an already represented identity has its own origin.
  await change(c.slug,'vote',overlap.token,{emailUpdates:true})
  if(order==='inner-first'){await unmerge(a.slug,f.headers);await unmerge(b.slug,f.headers)}
  else {await unmerge(b.slug,f.headers);await unmerge(a.slug,f.headers)}
  await unmerge(d.slug,f.headers)
  for(const [r,voters] of [[a,[onlyA.id,overlap.id]],[b,[overlap.id]],[c,[overlap.id,later.id]],[d,[overlap.id]]] as const){
    const rows=await env.DB.prepare('SELECT requester_id FROM request_votes WHERE request_id=? ORDER BY requester_id').bind(r.id).all<{requester_id:string}>()
    expect(rows.results.map(v=>v.requester_id)).toEqual([...voters].sort())
  }
  expect((await env.DB.prepare('SELECT request_id FROM request_follows WHERE requester_id=?').bind(onlyA.id).all()).results).toEqual([{request_id:a.id}])
  for(const r of [a,b,c,d])expect((await env.DB.prepare('SELECT evidence_id FROM request_evidence_links WHERE request_id=?').bind(r.id).all()).results).toHaveLength(1)
})

it('[F02] two disjoint sources with the same voter retain demand until both are detached',async()=>{
  const f=await boardGraph(),[a,b,c]=f.requests,who=await person()
  for(const r of [a,b])await change(r.slug,'vote',who.token,{emailUpdates:true})
  await merge(a.slug,c.slug,f.headers);await merge(b.slug,c.slug,f.headers)
  await unmerge(a.slug,f.headers)
  expect((await env.DB.prepare('SELECT * FROM request_votes WHERE request_id=?').bind(c.id).all()).results).toHaveLength(1)
  await unmerge(b.slug,f.headers)
  expect((await env.DB.prepare('SELECT * FROM request_votes WHERE request_id=?').bind(c.id).all()).results).toHaveLength(0)
  expect((await env.DB.prepare('SELECT * FROM request_follows WHERE request_id=?').bind(c.id).all()).results).toHaveLength(0)
})

it('[F01] mute and unvote apply to the complete current contribution graph',async()=>{
  const f=await boardGraph(),[a,b,c]=f.requests,who=await person()
  await change(a.slug,'vote',who.token,{emailUpdates:true});await merge(a.slug,b.slug,f.headers);await merge(b.slug,c.slug,f.headers)
  await change(c.slug,'follow',who.token,{muted:true},'PATCH');await change(c.slug,'vote',who.token,undefined,'DELETE')
  await unmerge(a.slug,f.headers);await unmerge(b.slug,f.headers)
  expect((await env.DB.prepare('SELECT * FROM request_votes WHERE requester_id=?').bind(who.id).all()).results).toHaveLength(0)
  expect(await env.DB.prepare('SELECT request_id,muted_at FROM request_follows WHERE requester_id=?').bind(who.id).first()).toEqual({request_id:a.id,muted_at:expect.any(String)})
})

it('[REQ-008/009] comments and published R2 attachments retain their origin through inner-first reversal',async()=>{
  const f=await boardGraph(),[a,b,c]=f.requests
  const comment=await call(`/api/operator/requests/${a.slug}/comments`,{body:'Original A discussion'},f.headers);expect(comment.status).toBe(201)
  const fileBytes=new Uint8Array([137,80,78,71,42]);const form=new FormData();form.set('file',new File([fileBytes],'original.png',{type:'image/png'}))
  const upload=await app.fetch(new Request(`http://penny.test/api/public/requests/${a.slug}/attachments`,{method:'POST',headers:auth(f.owner.token),body:form}),bindings);expect(upload.status).toBe(201)
  const file=await upload.json() as {id:string};expect((await call(`/api/operator/attachments/${file.id}/moderate`,{verdict:'approved'},f.headers)).status).toBe(200)
  await merge(a.slug,b.slug,f.headers);await merge(b.slug,c.slug,f.headers);await unmerge(a.slug,f.headers);await unmerge(b.slug,f.headers)
  expect(await env.DB.prepare('SELECT request_id,origin_request_id FROM request_comments').first()).toEqual({request_id:a.id,origin_request_id:a.id})
  expect(await env.DB.prepare('SELECT request_id,origin_request_id FROM attachments').first()).toEqual({request_id:a.id,origin_request_id:a.id})
  expect(new Uint8Array(await (await call(`/api/public/attachments/${file.id}`)).arrayBuffer())).toEqual(fileBytes)
})

for(const action of ['merged','unmerged'])it(`[REQ-008/009] real D1 late audit fault rolls back complete ${action} graph`,async()=>{
  const f=await boardGraph(2),[a,b]=f.requests,who=await person()
  await change(a.slug,'vote',who.token,{emailUpdates:true})
  if(action==='unmerged')await merge(a.slug,b.slug,f.headers)
  const before=await graphSnapshot()
  await env.DB.exec(`CREATE TRIGGER repair_late_fault BEFORE INSERT ON audit_entries WHEN NEW.action='request.${action}' BEGIN SELECT RAISE(ABORT,'synthetic late audit failure'); END;`)
  try {
    const response=await call(`/api/operator/requests/${a.slug}/${action==='merged'?'merge':'unmerge'}`,action==='merged'?{targetSlug:b.slug}:{},f.headers)
    expect(response.status).toBe(503)
    expect(await graphSnapshot()).toEqual(before)
  }finally{await env.DB.exec('DROP TRIGGER repair_late_fault')}
})

it('[REQ-008] opposite concurrent merges cannot create a cycle',async()=>{
  const f=await boardGraph(2),[a,b]=f.requests
  const results=await Promise.all([call(`/api/operator/requests/${a.slug}/merge`,{targetSlug:b.slug},f.headers),call(`/api/operator/requests/${b.slug}/merge`,{targetSlug:a.slug},f.headers)])
  expect(results.filter(r=>r.status===200)).toHaveLength(1)
  const rows=await env.DB.prepare('SELECT * FROM request_canonical_roots').all();expect(rows.results).toHaveLength(2)
  expect((await env.DB.prepare('SELECT id FROM requests WHERE merged_into_request_id IS NULL').all()).results).toHaveLength(1)
  const pages=await Promise.all([call(`/api/public/requests/${a.slug}`),call(`/api/public/requests/${b.slug}`)])
  expect(pages.map(r=>r.status).sort()).toEqual([200,301])
})

describe('consent after publication changes',()=>{
 for(const kind of ['internal','withdrawn','blocked'])it(`[REQ-010/025] caller can revoke after ${kind} without receiving private data`,async()=>{
  const f=await boardGraph(1),[a]=f.requests,who=await person()
  await change(a.slug,'follow',who.token)
  if(kind==='internal')expect((await call(`/api/operator/boards/${f.board}`,{visibility:'internal'},f.headers,'PATCH')).status).toBe(200)
  if(kind==='withdrawn')await change(a.slug,'withdraw',f.owner.token)
  if(kind==='blocked')expect((await call(`/api/operator/requesters/${f.owner.id}/block`,{},f.headers)).status).toBe(200)
  const activity=await (await call('/api/public/requester/activity',undefined,auth(who.token))).json() as {follows:{slug:string}[]}
  expect(activity.follows.map(r=>r.slug)).toContain(a.slug)
  expect(JSON.stringify(activity)).not.toContain('Original')
  await change(a.slug,'follow',who.token,{muted:true},'PATCH')
  await change(a.slug,'follow',who.token,undefined,'DELETE')
  expect((await env.DB.prepare('SELECT * FROM requester_update_permissions WHERE revoked_at IS NULL').all()).results).toHaveLength(0)
 })
})

it('[REQ-021] withdrawing a merged source marks only its original evidence',async()=>{
 const f=await boardGraph(2),[a,b]=f.requests
 const originals=await env.DB.prepare('SELECT request_id,evidence_id FROM request_evidence_contributions').all<{request_id:string;evidence_id:string}>()
 await merge(a.slug,b.slug,f.headers);await change(a.slug,'withdraw',f.owner.token)
 for(const row of originals.results)expect((await env.DB.prepare('SELECT withdrawn_at FROM evidence_items WHERE id=?').bind(row.evidence_id).first<{withdrawn_at:string|null}>())!.withdrawn_at===null).toBe(row.request_id!==a.id)
})

it('[REQ-021] withdrawal stops transferred source votes counting without erasing later canonical demand',async()=>{
 const f=await boardGraph(2),[a,b]=f.requests,sourceVoter=await person(),canonicalVoter=await person()
 await change(a.slug,'vote',sourceVoter.token);await merge(a.slug,b.slug,f.headers);await change(b.slug,'vote',canonicalVoter.token)
 await change(a.slug,'withdraw',f.owner.token)
 expect((await env.DB.prepare('SELECT requester_id FROM request_votes WHERE request_id=?').bind(b.id).all()).results).toEqual([{requester_id:canonicalVoter.id}])
 expect((await env.DB.prepare('SELECT * FROM request_vote_contributions WHERE request_id=?').bind(a.id).all()).results).toHaveLength(1)
})
