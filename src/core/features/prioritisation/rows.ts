import {readHierarchy} from '../hierarchy/repository'
import {voteImportanceSql} from '../requests/vote-importance'
import type {FormulaRow} from './formulas'

/** Counts come from current native relationships; no scores enter source records. */
export async function comparisonRows(db:D1Database,entity:'requests'|'features'):Promise<FormulaRow[]>{
 const results=await db.prepare(`WITH voters AS (
  SELECT v.request_id,v.requester_id,${voteImportanceSql()} AS importance FROM request_votes v JOIN requesters p ON p.id=v.requester_id WHERE p.blocked_at IS NULL
 ), account_demand AS (
  SELECT v.request_id,a.account_id FROM voters v JOIN requester_account_links a ON a.requester_id=v.requester_id
  UNION SELECT l.request_id,e.account_id FROM request_evidence_links l JOIN evidence_items e ON e.id=l.evidence_id WHERE e.account_id IS NOT NULL
 ) SELECT r.id,r.title,
  (SELECT count(*) FROM voters v WHERE v.request_id=r.id) votes,
  (SELECT count(*) FROM account_demand a WHERE a.request_id=r.id) accounts,
  (SELECT count(DISTINCT evidence_id) FROM request_evidence_links e WHERE e.request_id=r.id) evidence,
  (SELECT count(*) FROM voters v WHERE v.request_id=r.id AND importance=1) importance1,
  (SELECT count(*) FROM voters v WHERE v.request_id=r.id AND importance=2) importance2,
  (SELECT count(*) FROM voters v WHERE v.request_id=r.id AND importance=3) importance3,
  (SELECT count(*) FROM voters v WHERE v.request_id=r.id AND importance=4) importance4
  FROM requests r WHERE r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL ORDER BY r.title,r.id`).all<FormulaRow&{importance1:number;importance2:number;importance3:number;importance4:number}>()
 const requests=results.results.map(r=>({id:r.id,title:r.title,votes:r.votes,accounts:r.accounts,evidence:r.evidence,importance:[r.importance1,r.importance2,r.importance3,r.importance4]}))
 if(entity==='requests')return requests
 const hierarchy=await readHierarchy(db)
 return hierarchy.features.map(f=>({id:f.id,title:f.name,votes:f.demand.voters,accounts:f.demand.accounts,evidence:f.demand.evidence,importance:[0,1,2,3].map(level=>requests.filter(r=>f.requests.some(link=>link.id===r.id)).reduce((sum,r)=>sum+r.importance[level],0))}))
}
