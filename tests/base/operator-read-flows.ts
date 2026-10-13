import { expect, it } from 'vitest'
import { env, call, owner } from './support'
import { seedOverviewAttention } from '../browser/operator-pages-data.mjs'
import type { SearchResult } from '../../src/core/features/workspace/search-repository'
import type { OperatorAccountDetail } from '../../src/core/shared/api/operator'
import type { WorkspaceOverviewDto } from '../../src/core/features/workspace/overview-dto'
import type { OperatorPage } from '../../src/core/features/workspace/list-query'
async function insert(table:string,row:Record<string,string|number|null>) {
 const now='2026-10-13T00:00:00.000Z',values={created_at:now,...(['requester_account_links','request_evidence_links','request_tag_assignments','evidence_tag_assignments','candidate_bet_evidence_links','candidate_bet_account_links'].includes(table)?{}:{updated_at:now}),...row}
 await env.DB.prepare(`INSERT INTO ${table}(${Object.keys(values).join(',')}) VALUES(${Object.keys(values).map(()=>'?').join(',')})`).bind(...Object.values(values)).run()
}
async function insertMany(table:string,rows:Record<string,string|number|null>[]) {
 if(!rows.length)return
 const now='2026-10-13T00:00:00.000Z'
 await env.DB.batch(rows.map(row=>{
  const values={created_at:now,...(['requester_account_links','request_evidence_links','request_tag_assignments','evidence_tag_assignments','candidate_bet_evidence_links','candidate_bet_account_links'].includes(table)?{}:{updated_at:now}),...row}
  return env.DB.prepare(`INSERT INTO ${table}(${Object.keys(values).join(',')}) VALUES(${Object.keys(values).map(()=>'?').join(',')})`).bind(...Object.values(values))
 }))
}
async function graph() {
 await seedOverviewAttention(env.DB)
 await insert('accounts',{id:'read-account',slug:'read-account',name:'accountonlymarker'})
 await insert('requesters',{id:'read-person',display_name:'persononlymarker'})
 await insert('requester_addresses',{id:'read-address',requester_id:'read-person',email:'emailonlymarker@example.test'})
 await insert('requester_account_links',{requester_id:'read-person',account_id:'read-account'})
 await insert('tags',{id:'read-tag',name:'linked-feedback'})
 await env.DB.prepare("UPDATE requests SET title='requesttitleonlymarker',description='descriptiononlymarker',author_requester_id='read-person' WHERE id='attention-request'").run()
 await env.DB.prepare("UPDATE evidence_items SET account_id='read-account',requester_id='read-person' WHERE id='attention-evidence'").run()
 await env.DB.prepare("UPDATE evidence_versions SET wording='wordingonlymarker' WHERE evidence_id='attention-evidence'").run()
 await env.DB.prepare("UPDATE decisions SET question='questiononlymarker',rationale='rationaleonlymarker' WHERE id='attention-decision'").run()
 await env.DB.prepare("UPDATE roadmap_items SET title='roadtitleonlymarker',summary='summaryonlymarker' WHERE id='attention-planned'").run()
 await env.DB.prepare("UPDATE release_versions SET title='releasetitleonlymarker',body='bodyonlymarker',subject_tags_json='[\"read-tag\"]' WHERE release_id='attention-draft-release'").run()
 await insert('request_tag_assignments',{request_id:'attention-request',tag_id:'read-tag'})
 await insert('evidence_tag_assignments',{evidence_id:'attention-evidence',tag_id:'read-tag'})
 await insert('candidate_bets',{id:'read-bet',decision_id:'attention-decision',title:'Approach',summary:'Bounded approach'})
 await insert('candidate_bet_evidence_links',{candidate_bet_id:'read-bet',evidence_id:'attention-evidence',stance:'supporting'})
 await insert('roadmap_evidence_links',{roadmap_item_id:'attention-planned',evidence_id:'attention-evidence'})
 await env.DB.prepare("UPDATE roadmap_items SET candidate_bet_id='read-bet' WHERE id='attention-planned'").run()
 // Existing mapping validation requires a published request and an explicitly approved mapping.
 await insert('roadmap_request_mappings',{roadmap_item_id:'attention-planned',request_id:'attention-request',approved_at:null,withdrawn_at:null})
}
type RequestSort='votes'|'recent'|'age'
type QueueSortFixture={matchedIds:string[];sortedIds:Record<RequestSort,string[]>;accountRequestIds:string[];decoys:Record<'moderation'|'board'|'status'|'tag'|'decision'|'account',string>}
async function seedQueueSortFixture():Promise<QueueSortFixture> {
 const anchor=Date.now(),minute=60_000,day=24*60*minute,at=(offset:number)=>new Date(anchor+offset).toISOString()
 const paged=Array.from({length:57},(_,index)=>{
  const id=`paged-${String(index).padStart(3,'0')}`,votes=index%7+1,activityAt=at((index%6+1)*minute),requestDrivesActivity=index%3===0
  return {id,votes,activityAt,createdAt:at(-(index%5+1)*day),requestUpdatedAt:requestDrivesActivity?activityAt:at(-2*60*minute),voteCreatedAt:at(-3*60*minute),voteUpdatedAt:requestDrivesActivity?at(-60*minute):activityAt}
 })
 const decoys={moderation:'queue-decoy-moderation',board:'queue-decoy-board',status:'queue-decoy-status',tag:'queue-decoy-tag',decision:'queue-decoy-decision',account:'queue-decoy-account'} as const
 const request=(id:string,overrides:Record<string,string|number|null>={}):Record<string,string|number|null>=>({id,slug:id,board_id:'attention-board',author_requester_id:'read-person',title:'Paged tie',description:'paged-record-marker directory-paged-marker',moderation_state:'awaiting_review',public_state:'unpublished',created_at:at(-day),updated_at:at(-60*minute),...overrides})
 await insert('boards',{id:'queue-other-board',slug:'queue-other-board',name:'Queue other board',visibility:'public',position:1})
 await insertMany('requesters',Array.from({length:7},(_,index)=>({id:`queue-sort-voter-${index}`,display_name:`Queue sort voter ${index}`})))
 const decoyRows=[
  request(decoys.moderation,{title:'Filter decoy',description:'',moderation_state:'rejected'}),
  request(decoys.board,{title:'Filter decoy',description:'',board_id:'queue-other-board'}),
  request(decoys.status,{title:'Filter decoy',description:'',public_state:'open'}),
  request(decoys.tag,{title:'Filter decoy',description:''}),
  request(decoys.decision,{title:'Filter decoy',description:''}),
  request(decoys.account,{title:'Filter decoy',description:'',author_requester_id:null}),
 ]
 const requestRows=[...paged.map(row=>request(row.id,{created_at:row.createdAt,updated_at:row.requestUpdatedAt})),...decoyRows]
 await insertMany('requests',requestRows)
 const taggedIds=[...paged.map(row=>row.id),decoys.moderation,decoys.board,decoys.status,decoys.decision,decoys.account]
 await insertMany('request_tag_assignments',taggedIds.map(request_id=>({request_id,tag_id:'read-tag'})))
 const mappedIds=[...paged.map(row=>row.id),decoys.moderation,decoys.board,decoys.status,decoys.tag,decoys.account]
 await insertMany('roadmap_request_mappings',mappedIds.map(request_id=>({roadmap_item_id:'attention-planned',request_id,approved_at:null,withdrawn_at:null})))
 const votes=paged.flatMap(row=>Array.from({length:row.votes},(_,index)=>({request_id:row.id,requester_id:`queue-sort-voter-${index}`,created_at:row.voteCreatedAt,updated_at:row.voteUpdatedAt})))
 await insertMany('request_votes',votes)
 await insertMany('request_vote_contributions',votes)
 const attention=await env.DB.prepare('SELECT created_at,updated_at FROM requests WHERE id=?').bind('attention-request').first<{created_at:string;updated_at:string}>()
 if(!attention)throw new Error('The attention request fixture is missing')
 const records=[...paged.map(({id,votes,createdAt,activityAt})=>({id,votes,createdAt,activityAt})),{id:'attention-request',votes:0,createdAt:attention.created_at,activityAt:attention.updated_at}]
 const idOrder=(left:{id:string},right:{id:string})=>left.id<right.id?-1:left.id>right.id?1:0
 const sortedIds:Record<RequestSort,string[]>={
  votes:[...records].sort((left,right)=>right.votes-left.votes||idOrder(left,right)).map(row=>row.id),
  recent:[...records].sort((left,right)=>right.activityAt.localeCompare(left.activityAt)||idOrder(left,right)).map(row=>row.id),
  age:[...records].sort((left,right)=>left.createdAt.localeCompare(right.createdAt)||idOrder(left,right)).map(row=>row.id),
 }
 const matchedIds=records.map(row=>row.id)
 const accountRequestIds=[...matchedIds,decoys.moderation,decoys.board,decoys.status,decoys.tag,decoys.decision]
 return {matchedIds,sortedIds,accountRequestIds,decoys}
}
export function registerOperatorReadFlows() {
 it('[OPS-004] private global search covers individual fields and refuses anonymous identity',async()=>{
  const cookie=await owner();await graph()
  const commitment={selectedCandidateBetId:'read-bet',ownerOperatorId:'attention-operator',confidence:'medium',reviewAt:'2026-11-01',noViableAlternativeReason:'The interview supports one viable approach.'}
  const committed=await call('/api/operator/decisions/attention-decision/commit',{...commitment,rationale:'historicalonlymarker'},cookie)
  expect(committed.status,await committed.clone().text()).toBe(200)
  const revised=await call('/api/operator/decisions/attention-decision/revisions',{...commitment,rationale:'rationaleonlymarker',expectedRevision:1},cookie)
  expect(revised.status,await revised.clone().text()).toBe(201)
  const markers:Record<string,string>={requesttitleonlymarker:'requests',descriptiononlymarker:'requests',wordingonlymarker:'evidence',questiononlymarker:'decisions',rationaleonlymarker:'decisions',historicalonlymarker:'decisions',roadtitleonlymarker:'roadmap',summaryonlymarker:'roadmap',releasetitleonlymarker:'releases',bodyonlymarker:'releases',persononlymarker:'requesters',emailonlymarker:'requesters',accountonlymarker:'accounts'}
  for(const [marker,entity] of Object.entries(markers)) {
   const response=await call(`/api/operator/search?q=${marker}`,undefined,cookie);expect(response.status,await response.clone().text()).toBe(200)
   const result=await response.json() as OperatorPage<SearchResult>;expect(result.total).toBe(1);expect(result.items.map(row=>row.entity)).toEqual([entity])
   for(const row of result.items)expect(row.href).toMatch(/^\/app\//)
   expect((await call(`/api/operator/search?q=${marker}`)).status).toBe(401)
   for(const path of ['requests','roadmap','releases']){
    const publicResponse=await call(`/api/public/${path}?q=${marker}`);expect(await publicResponse.text()).not.toContain(marker)
   }
  }
  const tagged=await(await call('/api/operator/search?q=marker&tag=read-tag',undefined,cookie)).json() as OperatorPage<SearchResult>
  expect(tagged.total).toBe(7);expect(tagged.items.map(row=>row.entity)).toEqual(['accounts','decisions','evidence','releases','requesters','requests','roadmap'])
  const filtered=await(await call('/api/operator/search?q=marker&tag=read-tag&entity=decisions',undefined,cookie)).json() as OperatorPage<SearchResult>
  expect(filtered.items.map(row=>row.id)).toEqual(['attention-decision']);expect(filtered.total).toBe(1)
  expect((await(await call('/api/operator/search?q=marker&tag=missing-tag',undefined,cookie)).json() as OperatorPage<SearchResult>).total).toBe(0)
  expect((await (await call('/api/operator/search?q=no-such-marker',undefined,cookie)).json() as OperatorPage<SearchResult>).items).toEqual([])
  expect((await call('/api/operator/search?page=999999999999',undefined,cookie)).status).toBe(400)
  // Pages read numeric text as text and refuse an invalid filter as a 400 page.
  const numeric=await call('/app/search?q=2024',undefined,{...cookie,Accept:'text/html'});expect(numeric.status).toBe(200);await numeric.body?.cancel()
  const invalid=await call('/app/feedback?sort=bogus',undefined,{...cookie,Accept:'text/html'});expect(invalid.status).toBe(400);await invalid.body?.cancel()
  const timingStart=performance.now();expect((await call('/api/operator/search?q=marker',undefined,cookie)).status).toBe(200);console.info('Bounded fixture search first page ms',performance.now()-timingStart)
 })
 it('[REQ-028 EVID-009] every entity list applies tags, bounded paging, stable ties and request filters',async()=>{
  const cookie=await owner();await graph()
  const expected:Record<string,string>={requests:'attention-request',evidence:'attention-evidence',decisions:'attention-decision',roadmap:'attention-planned',releases:'attention-draft-release',accounts:'read-account',requesters:'read-person'}
  for(const [entity,id] of Object.entries(expected)){
   const page=await (await call(`/api/operator/${entity}?tag=read-tag`,undefined,cookie)).json() as OperatorPage<{id:string}>
   expect(page.items.map(row=>row.id)).toContain(id);expect(new Set(page.items.map(row=>row.id)).size).toBe(page.items.length)
   const none=await (await call(`/api/operator/${entity}?tag=missing-tag`,undefined,cookie)).json() as OperatorPage<{id:string}>
   expect(none.total).toBe(0);expect(none.items).toEqual([])
   expect((await call(`/api/operator/${entity}?page=0`,undefined,cookie)).status).toBe(400)
   expect((await call(`/api/operator/${entity}?sort=invalid`,undefined,cookie)).status).toBe(400)
  }
  const combined='/api/operator/requests?moderation=awaiting_review&board=attention-board&status=unpublished&tag=read-tag&decision=attention-decision&account=read-account&sort=votes'
  const queue=await seedQueueSortFixture()
  for(const sort of ['votes','recent','age'] as const) {
   const expectedIds=queue.sortedIds[sort],pages:OperatorPage<{id:string}>[]=[]
   for(let page=1;;page++) {
    const response=await call(`${combined.replace('sort=votes',`sort=${sort}`)}&page=${page}`,undefined,cookie);expect(response.status,await response.clone().text()).toBe(200)
    const result=await response.json() as OperatorPage<{id:string}>
    expect(result.page).toBe(page);expect(result.total).toBe(expectedIds.length);expect(result.pageSize).toBeGreaterThan(0);expect(result.items.length).toBeLessThanOrEqual(result.pageSize)
    pages.push(result)
    if(result.items.length<result.pageSize)break
   }
   const ids=pages.flatMap(page=>page.items.map(row=>row.id))
   expect(pages.length).toBeGreaterThan(2);expect(ids).toEqual(expectedIds);expect(new Set(ids).size).toBe(expectedIds.length)
   const exhausted=await(await call(`${combined.replace('sort=votes',`sort=${sort}`)}&page=${pages.length+1}`,undefined,cookie)).json() as OperatorPage<{id:string}>
   expect(exhausted.total).toBe(expectedIds.length);expect(exhausted.items).toEqual([])
  }
  const diagnostic=combined.replace('sort=votes','sort=name')
  for(const [url,id] of [
   [diagnostic.replace('moderation=awaiting_review','moderation=rejected'),queue.decoys.moderation],
   [diagnostic.replace('board=attention-board','board=queue-other-board'),queue.decoys.board],
   [diagnostic.replace('status=unpublished','status=open'),queue.decoys.status],
  ] as const) {
   const result=await(await call(url,undefined,cookie)).json() as OperatorPage<{id:string}>
   expect(result.total).toBe(1);expect(result.items.map(row=>row.id)).toEqual([id])
  }
  for(const [filter,id] of [['&tag=read-tag',queue.decoys.tag],['&decision=attention-decision',queue.decoys.decision],['&account=read-account',queue.decoys.account]] as const) {
   const result=await(await call(diagnostic.replace(filter,''),undefined,cookie)).json() as OperatorPage<{id:string}>
   expect(result.total).toBe(queue.matchedIds.length+1);expect(result.items.map(row=>row.id)).toContain(id)
  }
  expect((await(await call(diagnostic.replace('moderation=awaiting_review','moderation=approved'),undefined,cookie)).json() as OperatorPage<{id:string}>).total).toBe(0)
  const pages=[]
  for(let page=1;page<=3;page++)pages.push(await(await call(`/api/operator/requests?q=paged-record-marker&sort=age&page=${page}`,undefined,cookie)).json() as OperatorPage<{id:string}>)
  expect(pages[0].items.length).toBeLessThan(pages[0].total);expect(pages[2].items.length).toBeGreaterThan(0)
  expect(pages.flatMap(page=>page.items.map(row=>row.id))).toEqual(queue.sortedIds.age.filter(id=>id!=='attention-request'))
  const repeat=await(await call('/api/operator/requests?q=paged-record-marker&sort=age&page=2',undefined,cookie)).json() as OperatorPage<{id:string}>
  expect(repeat.items).toEqual(pages[1].items)
  // Each remaining directory proves adjacent server pages through the same public API.
  for(const [entity,table,sourceId,field] of [
   ['accounts','accounts','read-account','name'],['requesters','requesters','read-person','display_name'],
   ['decisions','decisions','attention-decision','title'],['roadmap','roadmap_items','attention-planned','title'],
   ['evidence','evidence_items','attention-evidence',null],['releases','releases','attention-draft-release',null],
  ] as const) {
   const original=await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(sourceId).first<Record<string,string|number|null>>()
   expect(original).not.toBeNull()
   for(let index=0;index<53;index++) {
    const id=`${entity}-paged-${String(index).padStart(3,'0')}`,row:Record<string,string|number|null>={...original!,id}
    if('slug' in row)row.slug=id
    if(field)row[field]='directory-paged-marker'
    if(entity==='releases')row.current_version_id=id+'-version'
    if(entity==='roadmap'){
     row.decision_id=`decisions-paged-${String(index).padStart(3,'0')}`
     row.candidate_bet_id=id+'-bet'
     await insert('candidate_bets',{id:row.candidate_bet_id,decision_id:row.decision_id,title:'Paged approach',summary:'One roadmap item per candidate bet'})
    }
    await insert(table,row)
    if(entity==='evidence')await insert('evidence_versions',{id:id+'-version',evidence_id:id,version_number:1,wording:'directory-paged-marker'})
    if(entity==='releases')await insert('release_versions',{id:id+'-version',release_id:id,version_number:1,title:'directory-paged-marker',body:'Private draft',release_type:'new',outcome_prompt:'Outcome',subject_tags_json:'[]',is_portal_current:0})
   }
   const ids:string[]=[]
   for(let page=1;page<=3;page++){
    const response=await call(`/api/operator/${entity}?q=directory-paged-marker&sort=age&page=${page}`,undefined,cookie);expect(response.status).toBe(200)
    const rows=await response.json() as OperatorPage<{id:string}>;expect(rows.items.length).toBeGreaterThan(0);ids.push(...rows.items.map(row=>row.id))
   }
   expect(ids).toEqual(Array.from({length:53},(_,index)=>`${entity}-paged-${String(index).padStart(3,'0')}`))
  }
  // Search crosses entity boundaries without omitting records or repeating title ties.
  const searchIds:string[]=[],searchPages:OperatorPage<SearchResult>[]=[]
  const expectedSearchIds=['accounts','decisions','evidence','releases','requesters','requests','roadmap'].flatMap(entity=>
   Array.from({length:entity==='requests'?57:53},(_,index)=>`${entity}:${entity==='requests'?'paged':entity+'-paged'}-${String(index).padStart(3,'0')}`),
  )
  for(let page=1;searchIds.length<expectedSearchIds.length;page++){
   const response=await call(`/api/operator/search?q=directory-paged-marker&page=${page}`,undefined,cookie);expect(response.status,await response.clone().text()).toBe(200)
   const result=await response.json() as OperatorPage<SearchResult>
   expect(result.total).toBe(expectedSearchIds.length);expect(result.items.length).toBeGreaterThan(0);expect(result.items.length).toBeLessThanOrEqual(result.pageSize)
   searchPages.push(result);searchIds.push(...result.items.map(row=>`${row.entity}:${row.id}`))
  }
  expect(searchPages.length).toBeGreaterThan(2);expect(searchIds).toEqual(expectedSearchIds)
  const repeatedSearch=await(await call('/api/operator/search?q=directory-paged-marker&page=3',undefined,cookie)).json() as OperatorPage<SearchResult>
  expect(repeatedSearch).toEqual(searchPages[2])
  const exhaustedSearch=await(await call(`/api/operator/search?q=directory-paged-marker&page=${searchPages.length+1}`,undefined,cookie)).json() as OperatorPage<SearchResult>
  expect(exhaustedSearch.total).toBe(expectedSearchIds.length);expect(exhaustedSearch.items).toEqual([])
  // Every account preview has a filtered, paged continuation, including direct and evidence-derived decisions.
  for(let index=0;index<53;index++) {
   const suffix=String(index).padStart(3,'0'),bet=`account-page-bet-${suffix}`
   await insert('requester_account_links',{requester_id:`requesters-paged-${suffix}`,account_id:'read-account'})
   await insert('candidate_bets',{id:bet,decision_id:`decisions-paged-${suffix}`,title:'Account-linked option',summary:'Private context'})
   if(index%2===0)await insert('candidate_bet_account_links',{candidate_bet_id:bet,account_id:'read-account'})
   else await insert('candidate_bet_evidence_links',{candidate_bet_id:bet,evidence_id:`evidence-paged-${suffix}`,stance:'supporting'})
   await insert('request_evidence_links',{request_id:`paged-${suffix}`,evidence_id:`evidence-paged-${suffix}`,stance:'supporting'})
  }
  const accountResponse=await call('/api/operator/accounts/read-account',undefined,cookie);expect(accountResponse.status).toBe(200)
  const account=await accountResponse.json() as OperatorAccountDetail
  for(const [entity,total,preview,sort,expectedIds] of [
   ['requests',account.linkedRequestCount,account.requests,'name',queue.accountRequestIds],
   ['requesters',account.requesterCount,account.requesters,'name',['read-person',...Array.from({length:53},(_,index)=>`requesters-paged-${String(index).padStart(3,'0')}`)]],
   ['decisions',account.linkedDecisionCount,account.decisions,'name',['attention-decision',...Array.from({length:53},(_,index)=>`decisions-paged-${String(index).padStart(3,'0')}`)]],
   ['evidence',account.evidenceCount,account.evidence,'observed',['attention-evidence',...Array.from({length:53},(_,index)=>`evidence-paged-${String(index).padStart(3,'0')}`)]],
  ] as const) {
   expect(preview.length).toBeGreaterThan(0);expect(preview.length).toBeLessThan(total)
   const pages:OperatorPage<{id:string;slug?:string}>[]=[]
   for(let page=1;page<=3;page++) {
    const response=await call(`/api/operator/${entity}?account=read-account&sort=${sort}&page=${page}`,undefined,cookie);expect(response.status).toBe(200)
    pages.push(await response.json() as OperatorPage<{id:string;slug?:string}>)
   }
   expect(pages.every(page=>page.total===total)).toBe(true)
   expect(pages.flatMap(page=>page.items.map(row=>row.id)).sort()).toEqual([...expectedIds].sort())
   expect(preview.map(row=>'slug' in row?row.slug:row.id)).toEqual(pages[0].items.map(row=>row.slug??row.id))
  }
  // Ready/review-due totals and all other attention totals survive sparse or exhausted pages.
  await env.DB.prepare("UPDATE decisions SET state='review_due' WHERE id='decisions-paged-000'").run()
  const firstAttention=await(await call('/api/operator/overview?sort=age',undefined,cookie)).json() as WorkspaceOverviewDto
  const laterAttention=await(await call('/api/operator/overview?sort=age&page=3',undefined,cookie)).json() as WorkspaceOverviewDto
  const exhaustedAttention=await(await call('/api/operator/overview?sort=age&page=4',undefined,cookie)).json() as WorkspaceOverviewDto
  expect(firstAttention.counts.readyDecisions).toBe(53);expect(firstAttention.counts.reviewDueDecisions).toBe(1)
  expect(laterAttention.decisions.length).toBeLessThan(firstAttention.counts.readyDecisions)
  expect(exhaustedAttention.decisions).toEqual([]);expect(exhaustedAttention.awaitingModeration).toEqual([])
  expect(laterAttention.counts).toEqual(firstAttention.counts);expect(exhaustedAttention.counts).toEqual(firstAttention.counts)
  const taggedOverview=await(await call('/api/operator/overview?tag=read-tag',undefined,cookie)).json() as {unreviewedEvidence:{id:string}[];pagination:{total:number}}
  expect(taggedOverview.unreviewedEvidence.map(row=>row.id)).toContain('attention-evidence');expect(taggedOverview.pagination.total).toBeGreaterThan(0)
  const taggedUpdates=await(await call('/api/operator/roadmap-updates?tag=read-tag&status=pending',undefined,cookie)).json() as OperatorPage<{id:string}>
  expect(taggedUpdates.items.map(row=>row.id)).toContain('attention-update')
  const zero=await(await call('/api/operator/moderation?q=absent-marker',undefined,cookie)).json() as OperatorPage<{id:string}>;expect(zero.items).toEqual([])
 })
}
