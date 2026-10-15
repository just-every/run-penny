import assert from 'node:assert/strict'
import {generatedOperatorTransport,generatedHeaders} from './operator-completeness-transport.mjs'
import {pacePublicContext,pacePublicPhase} from './public-entry-pacing.mjs'
export const localProofKey='synthetic-browser-local-gate-proof-1234567890'
const offset=((12-new Date().getUTCHours()+12)%24)-12
const businessTimezone=offset===0?'Etc/GMT':`Etc/GMT${offset>0?'-':'+'}${Math.abs(offset)}`
export const localProofBindings={WORKSPACE_TIMEZONE:businessTimezone,PENNY_ENVIRONMENT:'test',MAIL_PROVIDER:'sendgrid',MAIL_FROM:'penny@example.test',MAIL_API_KEY:'synthetic-provider-test-key',RER_DEV_KEY:localProofKey}
export async function api(page,path,body,method=body===undefined?'GET':'POST') {
 const response=await page.context().request.fetch(new URL(path,page.url()).href,{method,...(body===undefined?{}:{data:body,headers:{Origin:new URL(page.url()).origin}})})
 return response
}
export async function invitePeer({page,browser,origin,width,capture,runtime,email='proof-peer@example.test'}) {
 await page.goto(origin+'/app/settings')
 const section=page.locator('#settings-operators')
 await section.getByLabel('Email',{exact:true}).fill(email)
 const invited=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/operator/settings/operators'&&r.request().method()==='POST')
 await section.getByRole('button',{name:'Invite operator',exact:true}).click()
 assert.equal((await invited).status(),202,'[OPS-001] native invitation accepted')
 await capture(email==='proof-peer@example.test'?'OPS-001-invited-settings':'OPS-002-successor-invited',page)
 const peerContext=await browser.newContext({viewport:{width,height:width===390?844:900},extraHTTPHeaders:{'CF-Connecting-IP':email==='proof-peer@example.test'?'198.51.100.20':'198.51.100.21'}})
 try {
  await pacePublicContext(peerContext,runtime,email==='proof-peer@example.test'?'198.51.100.20':'198.51.100.21')
  const peer=await peerContext.newPage()
  assert.equal((await peerContext.request.get(origin+'/__dev/outbox')).status(),404,'[OPS-001] anonymous outbox denied')
  const confirmation=runtime.outbox.findLast(message=>message.email===email)?.url
  assert.ok(confirmation,'[OPS-001] provider receives real invitation link')
  await peer.goto(confirmation)
  await peer.getByRole('button',{name:'Confirm',exact:true}).waitFor()
  assert.equal((await peerContext.request.get(origin+'/api/auth/session')).status(),401,'GET preview does not consume link or create session')
  await peer.reload()
  await pacePublicPhase(peer)
  await peer.getByRole('button',{name:'Confirm',exact:true}).click()
  await peer.waitForURL(url=>['/app','/app/','/app/overview'].includes(url.pathname))
  await peer.goto(origin+'/app/settings')
  await peer.getByRole('heading',{name:'Operators',exact:true}).waitFor()
  const members=await (await api(peer,'/api/operator/settings/operators')).json()
  const owner=members.operators.find(row=>row.initialOwner),invitee=members.operators.find(row=>row.email===email)
  assert.equal(invitee.status,'active')
  const generatedPath=await generatedOperatorTransport()
  const generated=await peerContext.request.get(origin+generatedPath,{headers:generatedHeaders(origin)})
  assert.equal(generated.status(),200);assert.match(await generated.text(),/privateproofaccountname/,'[OPS-002] peer independently admitted by generated loader')
  assert.equal((await api(peer,`/api/operator/settings/operators/${owner.id}`,{},'DELETE')).status(),403,'[OPS-002] forged peer removal of setup owner denied')
  assert.equal(await peer.getByRole('button',{name:`Remove ${owner.email}`,exact:true}).isDisabled(),true)
  const foreign=await peerContext.request.delete(origin+`/api/operator/settings/operators/${invitee.id}`,{headers:{Origin:'https://foreign.example.test'},data:{}})
  assert.equal(foreign.status(),403,'[OPS-002] management same-origin fence')
  const boardForm=peer.locator('form').filter({has:peer.getByRole('button',{name:'Create board',exact:true})})
  await boardForm.getByLabel('Name',{exact:true}).fill('Peer ordinary operation')
  await boardForm.getByLabel('URL name',{exact:true}).fill(email==='proof-peer@example.test'?'peer-operation':'successor-operation')
  await boardForm.getByRole('button',{name:'Create board',exact:true}).click()
  await peer.getByText(`URL name: ${email==='proof-peer@example.test'?'peer-operation':'successor-operation'}`,{exact:false}).waitFor()
  await capture(email==='proof-peer@example.test'?'OPS-002-peer-operates':'OPS-002-successor-operates',peer)
  if(email==='proof-peer@example.test') {
   const peerOperators=peer.locator('#settings-operators')
   await peerOperators.getByLabel('Email',{exact:true}).fill('proof-cancelled@example.test')
   const issued=peer.waitForResponse(r=>new URL(r.url()).pathname==='/api/operator/settings/operators'&&r.request().method()==='POST')
   await peerOperators.getByRole('button',{name:'Invite operator',exact:true}).click();assert.equal((await issued).status(),202,'[OPS-002] invited operator can invite peer')
   await peer.getByRole('button',{name:'Cancel invitation for proof-cancelled@example.test',exact:true}).click()
   const cancelled=peer.waitForResponse(r=>new URL(r.url()).pathname.startsWith('/api/operator/settings/operators/')&&r.request().method()==='DELETE')
   await peer.getByRole('button',{name:'Confirm removal',exact:true}).click();assert.equal((await cancelled).status(),200,'[OPS-002] invited operator can remove peer')
  }
  // Hold a second unconsumed native magic link, alongside the active cookie.
  assert.equal((await api(peer,'/api/auth/magic-link',{email,returnTo:'/app'})).status(),202)
  const staleLink=runtime.outbox.findLast(message=>message.email===email)?.url
  assert.ok(staleLink)
  return {peer,peerContext,invitee,staleLink,confirmation,generatedPath,close:()=>peerContext.close()}
 }catch(error){await peerContext.close();throw error}
}
export async function revokePeer({page,origin,peerState,capture,db}) {
 await page.goto(origin+'/app/settings')
 await page.getByRole('button',{name:'Remove proof-peer@example.test',exact:true}).click()
 const removed=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/operator/settings/operators/${peerState.invitee.id}`&&r.request().method()==='DELETE')
 await page.getByRole('button',{name:'Confirm removal',exact:true}).click()
 assert.equal((await removed).status(),200)
 await capture('OPS-002-removed-peer',page)
 for(const path of ['/api/auth/session','/api/operator/search?q=privateproof','/api/operator/settings/operators','/api/operator/accounts'])assert.equal((await peerState.peerContext.request.get(origin+path)).status(),401,`[OPS-002] stale native cookie denied ${path}`)
 const generated=await peerState.peerContext.request.get(origin+peerState.generatedPath,{headers:generatedHeaders(origin)})
 assert.equal(generated.status(),200,'[OPS-002] TanStack serializes generated loader redirects over HTTP 200')
 const denied=await generated.json()
 assert.equal(denied.isSerializedRedirect,true,'[OPS-002] revoked generated loader requires a serialized redirect')
 assert.equal(denied.to,'/signin','[OPS-002] revoked generated loader redirects to sign-in')
 assert.equal(Object.hasOwn(denied,'resources'),false);assert.equal(Object.hasOwn(denied,'result'),false)
 assert.doesNotMatch(JSON.stringify(denied),/privateproof|customproof|\/api\/operator\//,'[OPS-002 OPS-004 DATA-004] revoked native generated loader discloses no private fields or resources')
 const privateDoc=await peerState.peerContext.request.get(origin+'/app/search',{maxRedirects:0})
 assert.ok([302,303,401].includes(privateDoc.status()),'[OPS-002] removed session cannot read private document')
 await peerState.peer.goto(new URL(peerState.staleLink,origin).href)
 if(await peerState.peer.getByRole('button',{name:'Confirm',exact:true}).count())await peerState.peer.getByRole('button',{name:'Confirm',exact:true}).click()
 assert.equal((await peerState.peerContext.request.get(origin+'/api/auth/session')).status(),401,'[OPS-002] outstanding native link cannot restore removed authority')
 const audit=await db.prepare("SELECT action,actor_id,entity_id,occurred_at FROM audit_entries WHERE action='operator.removed' AND entity_id=?").bind(peerState.invitee.id).first()
 assert.equal(audit?.entity_id,peerState.invitee.id,'[BASE-OPS-005] removal audit survives inactive target')
 assert.ok(audit.actor_id&&Number.isFinite(Date.parse(audit.occurred_at)))
}

export async function removeInitialOwner({page,origin,successor,capture,db}) {
 const members=(await (await api(page,'/api/operator/settings/operators')).json()).operators
 const owner=members.find(row=>row.initialOwner)
 await page.goto(origin+'/app/settings')
 await page.getByRole('button',{name:`Remove ${owner.email}`,exact:true}).click()
 await page.getByLabel('Hand ownership to').selectOption({index:1})
 await page.getByRole('button',{name:'Confirm removal',exact:true}).click()
 await page.waitForURL(url=>url.pathname==='/signin')
 await capture('OPS-002-initial-owner-self-removed',page)
 assert.equal((await api(page,'/api/auth/session')).status(),401)
 assert.equal((await api(page,'/api/operator/settings/operators')).status(),401)
 const inactive=await db.prepare('SELECT status FROM oa_operators WHERE id=?').bind(owner.id).first()
 assert.equal(inactive.status,'inactive','[OPS-002] environment allowlist cannot silently revive initial owner')
 const peerSession=await api(successor.peer,'/api/auth/session')
 assert.equal(peerSession.status(),401,'[OPS-002] installation-role transfer revokes prior successor session')
}
