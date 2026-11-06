import { expect } from 'vitest'
import { call, env } from './support'

/** Parse quoted CSV records, including escaped quotes and embedded newlines. */
export function parseCsv(text:string):Record<string,string>[] {
 const records:string[][]=[]
 let record:string[]=[],cell='',quoted=false
 for(let index=0;index<text.length;index++){
  const character=text[index]
  if(character==='"'){
   if(quoted&&text[index+1]==='"'){cell+='"';index++}else quoted=!quoted
  }else if(!quoted&&(character===','||character==='\n'||character==='\r')){
   record.push(cell);cell=''
   if(character!==','){
    records.push(record);record=[]
    if(character==='\r'&&text[index+1]==='\n')index++
   }
  }else cell+=character
 }
 expect(quoted).toBe(false)
 if(cell||record.length){record.push(cell);records.push(record)}
 const [columns,...rows]=records
 expect(columns.length).toBeGreaterThan(0)
 expect(new Set(columns).size).toBe(columns.length)
 return rows.map(row=>{
  expect(row).toHaveLength(columns.length)
  return Object.fromEntries(columns.map((column,index)=>[column,row[index]]))
 })
}

type ExpectedRequest={slug:string;voters:{id:string;name:string;proxy:number}[]}

/** One native export journey, folded into the existing proxy-vote registration. */
export async function reconcileVoteCsv(operator:Record<string,string>,requester:Record<string,string>,expected:ExpectedRequest[]){
 const read=async(path:string)=>{
  const response=await call(path,undefined,operator)
  expect(response.status,await response.clone().text()).toBe(200)
  expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  return parseCsv(await response.text())
 }
 const requests=await read('/api/operator/requests/export.csv'),voters=await read('/api/operator/votes/export.csv')
 // The fixture explicitly names every request and vote, independently of either export.
 expect(requests.map(row=>row.request).sort()).toEqual(expected.map(row=>row.slug).sort())
 expect(requests).toHaveLength((await env.DB.prepare('SELECT COUNT(*) n FROM requests').first<number>('n'))!)
 expect(voters).toHaveLength(expected.reduce((sum,row)=>sum+row.voters.length,0))
 expect(voters).toHaveLength((await env.DB.prepare('SELECT COUNT(*) n FROM request_votes v JOIN requesters p ON p.id=v.requester_id JOIN requests r ON r.id=v.request_id WHERE p.blocked_at IS NULL AND r.withdrawn_at IS NULL').first<number>('n'))!)
 for(const fixture of expected){
  const row=requests.find(row=>row.request===fixture.slug)!,individuals=voters.filter(row=>row.request===fixture.slug)
  expect(row.vote_count).toBe(String(fixture.voters.length))
  expect(individuals.map(person=>({id:person.customer_id,name:person.customer,proxy:Number(person.proxy)})).sort((a,b)=>a.id.localeCompare(b.id)))
   .toEqual([...fixture.voters].sort((a,b)=>a.id.localeCompare(b.id)))
  expect(new Set(individuals.map(person=>person.customer_id)).size).toBe(individuals.length)
  const publicResponse=await call(`/api/public/requests/${fixture.slug}`)
  expect(publicResponse.status).toBe(200)
  expect(await publicResponse.json()).toMatchObject({voteCount:fixture.voters.length})
  const response=await call(`/api/operator/requests/${fixture.slug}/context`,undefined,operator)
  expect(response.status).toBe(200)
  const context=await response.json() as {demand:{voteCount:number};voters:{id:string;nativeProxy:number;votedAt:string}[]}
  expect(context.demand.voteCount).toBe(fixture.voters.length)
  expect([...new Set(context.voters.map(person=>person.id))].sort()).toEqual(fixture.voters.map(person=>person.id).sort())
  for(const person of individuals){
   const native=context.voters.filter(voter=>voter.id===person.customer_id)
   expect(native.length).toBeGreaterThan(0)
   for(const voter of native){expect(person.proxy).toBe(String(voter.nativeProxy));expect(person.voted_at).toBe(voter.votedAt)}
  }
 }
 for(const path of ['/api/operator/requests/export.csv','/api/operator/votes/export.csv'])
  for(const headers of [{},requester])expect((await call(path,undefined,headers)).status).toBe(401)
 return voters
}
