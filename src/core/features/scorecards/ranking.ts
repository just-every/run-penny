import type {Definition} from './input'
export interface RequestRow {id:string;slug:string;title:string}
export interface ScoreRow {request_id:string;operator_id:string;display_name:string;inputs_json:string;updated_at:string}
// Scores are normalized by the declared scale. Each criterion averages only
// the operators who supplied it; no missing input is converted to zero.
// The weighted result is absent until every positive-weight criterion exists.
const stable=(n:number)=>Math.round(n*1e12)/1e12
export function rankRequests(definition:Definition,requests:RequestRow[],scores:ScoreRow[]) {
 const rows=requests.map(request=>{
  const scorers=scores.filter(s=>s.request_id===request.id).map(s=>({operatorId:s.operator_id,displayName:s.display_name,inputs:JSON.parse(s.inputs_json) as Record<string,number>,updatedAt:s.updated_at}))
  const components=definition.criteria.map(criterion=>{
   const values=scorers.flatMap(s=>Object.hasOwn(s.inputs,criterion.key)?[s.inputs[criterion.key]]:[])
   const mean=values.length?stable(values.reduce((sum,n)=>sum+n,0)/values.length):null
   const contribution=mean===null?null:stable(mean/criterion.scale*criterion.weight)
   return {...criterion,count:values.length,mean,contribution}
  })
  const missing=components.filter(c=>c.weight>0&&c.mean===null).map(c=>c.key)
  const result=missing.length?null:stable(components.reduce((sum,c)=>sum+(c.contribution??0),0)/components.reduce((sum,c)=>sum+c.weight,0))
  return {requestId:request.id,slug:request.slug,title:request.title,scorers,components,missing,weightedResult:result,rank:null as number|null}
 })
 rows.sort((a,b)=>(a.weightedResult===null?(b.weightedResult===null?0:1):b.weightedResult===null?-1:b.weightedResult-a.weightedResult)||(a.requestId<b.requestId?-1:a.requestId>b.requestId?1:0))
 let rank=0
 for(const [index,row] of rows.entries())if(row.weightedResult!==null){if(index===0||rows[index-1].weightedResult!==row.weightedResult)rank=index+1;row.rank=rank}
 return rows
}
