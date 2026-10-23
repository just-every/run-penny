import {expect} from 'vitest'
import {env} from 'cloudflare:workers'
import {csvRecords} from '../csv-records.mjs'
type Call=(path:string,body?:unknown,headers?:Record<string,string>)=>Response|Promise<Response>
export async function proveCsvExports(call:Call,cookie:Record<string,string>){
 const json=async<T>(path:string,body?:unknown):Promise<T>=>{const response=await call(path,body,cookie);expect(response.status,await response.clone().text()).toBeLessThan(300);return response.json() as Promise<T>}
 const hostile='=SUM(1,2), "quoted"\r\nsecond line'
 const request=await json<{id:string;slug:string}>('/api/operator/requests',{boardSlug:'b',title:hostile,description:'synthetic-penny-description'})
 const people=[]
 for(const name of ['synthetic-penny-person-1','synthetic-penny-person-2','synthetic-penny-erased'])people.push(await json<{requesterId:string}>(`/api/operator/requests/${request.slug}/proxy-votes`,{contact:{displayName:name,email:name+'@example.test'},source:'synthetic-penny-source'}))
 const root={table:'requesters',id:people[2].requesterId},preview=await json<{planHash:string}>('/api/operator/data/erasure/preview',root)
 const erased=await json<{operationId:string;status:string}>('/api/operator/data/erasure',{...root,planHash:preview.planHash})
 expect(erased.status).toBe('complete')
 await json('/api/operator/requests/r/proxy-votes',{contact:{displayName:'synthetic-penny-withdrawn'},source:'synthetic-penny-source'})
 const stamp=new Date().toISOString()
 // A retained withdrawn request still has historical votes, which must not export a person.
 await env.DB.prepare('UPDATE requests SET withdrawn_at=?,public_state=? WHERE id=?').bind(stamp,'withdrawn','r').run()
 for(const prefix of ['+','-','@','\t','\r'])await env.DB.prepare("INSERT INTO requests(id,slug,board_id,title,description,moderation_state,public_state,created_at,updated_at) VALUES(?,?,'b',?,'Fixture','awaiting_review','open',?,?)").bind(crypto.randomUUID(),crypto.randomUUID(),prefix+'synthetic-penny-formula',stamp,stamp).run()
 const before=await env.DB.prepare("SELECT count(*) n FROM audit_entries WHERE action='data.csv_exported'").first<number>('n')
 const requestsResponse=await call('/api/operator/data/requests.csv',undefined,cookie),votersResponse=await call('/api/operator/data/voters.csv',undefined,cookie)
 expect(requestsResponse.status).toBe(200);expect(votersResponse.status).toBe(200)
 const text=await requestsResponse.text(),votersText=await votersResponse.text(),requests=csvRecords(text),voters=csvRecords(votersText)
 expect(text.charCodeAt(0)).not.toBe(0xfeff);expect(text).toContain('\r\n');expect(text).toContain('""quoted""')
 expect(requests.find(row=>row.request_id===request.id)?.title).toBe("'"+hostile)
 for(const prefix of ['+','-','@','\t','\r'])expect(requests.some(row=>row.title==="'"+prefix+'synthetic-penny-formula')).toBe(true)
 const product=await json<{total:number}>('/api/operator/requests')
 expect(requests).toHaveLength(product.total)
 for(const row of requests)expect(voters.filter(voter=>voter.request_id===row.request_id)).toHaveLength(Number(row.vote_total))
 expect(voters.filter(row=>row.request_id===request.id)).toHaveLength(2);expect(voters.every(row=>row.proxy==='yes')).toBe(true)
 const recorder=await env.DB.prepare("SELECT p.id,p.display_name FROM operators p JOIN oa_operators n ON n.email=p.email WHERE n.role='owner'").first<{id:string;display_name:string}>()
 expect(voters.every(row=>row.recorder_id===recorder!.id&&row.recorder===recorder!.display_name)).toBe(true)
 for(const value of ['synthetic-penny-erased','synthetic-penny-withdrawn','@example.test','synthetic-penny-source'])expect(votersText).not.toContain(value)
 expect(voters.some(row=>row.request_id==='r')).toBe(false)
 expect(await env.DB.prepare("SELECT count(*) n FROM audit_entries WHERE action='data.csv_exported'").first('n')).toBe(Number(before)+2)
 const view=await json<{id:string}>('/api/operator/saved-views',{listKind:'requests',name:'synthetic-penny-csv-view',scope:'private',filter:{q:'SUM'},sort:'name',columns:['title']})
 const list=await json<{items:{id:string}[]}>('/api/operator/moderation?view='+view.id)
 const filtered=csvRecords(await(await call('/api/operator/data/requests.csv?view='+view.id,undefined,cookie)).text())
 expect(filtered.map(row=>row.request_id).sort()).toEqual(list.items.map(row=>row.id).sort())
 expect((await call('/api/operator/data/requests.csv?foreign=field',undefined,cookie)).status).toBe(400)
 const operator=await env.DB.prepare("SELECT id FROM oa_operators WHERE role='owner'").first<string>('id')
 await env.DB.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES('synthetic-penny-other-owner','synthetic-penny-owner@example.test','Other owner','owner','active',1,?)").bind(Date.now()).run()
 for(const role of ['admin','member']){await env.DB.prepare('UPDATE oa_operators SET role=? WHERE id=?').bind(role,operator).run();await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=?) WHERE operator_id=?').bind(operator,operator).run();for(const endpoint of ['/api/operator/data/requests.csv','/api/operator/data/voters.csv','/api/operator/votes/export.csv'])expect((await call(endpoint,undefined,cookie)).status).toBe(403)}
 await env.DB.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(operator).run()
 expect((await call('/api/operator/data/requests.csv')).status).toBe(401)
}
