import assert from 'node:assert/strict'

/** Native key issuance/revocation and export use only the disposable person's
 * normal HTTP doors. No database writes or substitute authority. */
export default async function journey({request,origin,cookie}) {
 const person=async(path,method='GET',body)=>request(origin+path,{method,headers:{Cookie:cookie,Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})})
 const issued=await person('/api/operator/integrations/keys','POST',{name:'Scoped conformance reader',scopes:['requests:read']})
 assert.equal(issued.status,201)
 const key=await issued.json()
 const call=async(name,args={})=>{
  const response=await request(origin+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+key.token,Origin:origin,'Content-Type':'application/json',Accept:'application/json','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name,arguments:args}})})
  return {status:response.status,value:await response.json()}
 }
 const publicRead=await call('penny.requests.public')
 assert.equal(publicRead.status,200);assert.ok(Array.isArray(publicRead.value.result?.structuredContent?.items))
 const privateRead=await call('penny.workspace.snapshot')
 assert.equal(privateRead.status,403);assert.equal(privateRead.value.error?.data?.code,'insufficient_scope')
 const removed=await person('/api/operator/integrations/keys/'+key.credential.id,'DELETE')
 assert.equal(removed.status,200);assert.equal((await call('penny.requests.public')).status,401)
 const exported=await person('/api/operator/data/export')
 assert.equal(exported.status,200)
 const archive=await exported.json(),tables=archive.archive.tables
 assert.ok(tables.audit_entries.some(row=>{
  const details=JSON.parse(row.details_json??'null');return typeof details?.preparedBy?.agent?.id==='string'&&details.preparedBy.for?.id===details.sponsorId&&typeof details.actorLabel==='string'&&details.actorLabel.includes(' for ')
 }))
 assert.ok(!Object.keys(tables).some(name=>/^(agent_door_|oa_|bs_|integration_tokens$|penny_api_issuers$|penny_agent_transaction$)/.test(name)))
 assert.ok(!JSON.stringify(archive).includes(key.token))
 console.log('Native lifecycle: scoped read succeeds; private scope and revoked key refuse; product export preserves agent attribution and excludes installation authority.')
}
