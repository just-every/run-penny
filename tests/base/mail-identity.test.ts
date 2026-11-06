import {applyD1Migrations,reset} from 'cloudflare:test'
import {exports} from 'cloudflare:workers'
import {beforeEach,afterEach,vi,expect,inject,it} from 'vitest'
import {mockMail,owner,finishFirstRun} from './support'
import {proveReleaseMailIdentity} from './release-mail-identity'
import {accepted,body,graph,call,env,origin} from './subscription-fixture'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()});afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks()})
it('[NOTIFY-013][OPS-005] setup requires company and postal details, rejected sender tests cannot save, and accepted identity reaches real follower and release transport',async()=>{
 const operator=await owner({finishSetup:false})
 const incomplete=await exports.default.fetch(new Request(origin+'/setup',{method:'POST',headers:{...operator,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&companyName=Example'}));expect(incomplete.status).toBe(400)
 expect(await env.DB.prepare('SELECT * FROM oa_first_run').first()).toBeNull()
 await accepted(finishFirstRun(operator,'UTC'),303)
 const g=await graph(operator),slug=await g.submit();await g.publish(slug);await g.flush()
 await accepted(call(`/api/public/requests/${slug}/follow`,{},g.voter),204)
 const input={companyName:'Example Company',senderName:'Customer team',fromAddress:'updates@example.test',replyTo:'team@example.test',postalAddress:'14 Example Street, Brisbane QLD 4000'}
 vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({errors:[{message:'Sender identity rejected'}]}),{status:403}))
 const rejected=await (await accepted(call('/api/operator/settings/mail/test',input,g.operator))).json() as {testId:string;accepted:boolean};expect(rejected.accepted).toBe(false)
 expect((await call('/api/operator/settings/mail',{...input,testId:rejected.testId,acceptProviderResult:true},g.operator,'PUT')).status).toBe(409)
 expect(await env.DB.prepare('SELECT from_address FROM penny_mail_identity').first('from_address')).toBeNull()
 const tested=await (await accepted(call('/api/operator/settings/mail/test',input,g.operator))).json() as {testId:string;accepted:boolean};expect(tested.accepted).toBe(true)
 await accepted(call('/api/operator/settings/mail',{...input,testId:tested.testId,acceptProviderResult:true},g.operator,'PUT'))
 await g.status(slug,'under_review');await g.flush()
 const update=g.sent.at(-1)!;expect(update.from).toEqual({email:input.fromAddress,name:input.senderName});expect(update.reply_to?.email).toBe(input.replyTo);expect(body(update)).toContain(input.postalAddress)
 // A legacy installation has already finished setup without a postal address.
 await env.DB.prepare('DELETE FROM penny_mail_identity').run()
 const custody=async()=>Object.fromEntries(await Promise.all(['penny_mail_identity','penny_weekly_summary','audit_entries','requester_update_permissions','notification_events','notification_intents','notification_outbox'].map(async table=>[table,(await env.DB.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()).results])))
 const beforeWeekly=await custody()
 const refused=await call('/api/operator/settings/weekly-summary',{enabled:true},g.operator,'PUT')
 expect(refused.status).toBe(409)
 expect(await refused.json()).toMatchObject({error:'postal_address_required',message:expect.stringMatching(/business postal address.*before enabling weekly requester summaries/iu)})
 expect(await custody()).toEqual(beforeWeekly)
 expect(await (await accepted(call('/api/operator/settings/weekly-summary',undefined,g.operator))).json()).toMatchObject({enabled:false})
 await accepted(call('/api/operator/boards/subscriptions/vote-subscriptions',{enabled:false,version:g.disclosure.version},g.operator,'PUT'))
 expect((await call('/api/operator/boards/subscriptions/vote-subscriptions',{enabled:true,version:g.disclosure.version+1},g.operator,'PUT')).status).toBe(409)
 const before=g.sent.length;await g.status(slug,'planned');await g.flush();expect(g.sent.length).toBeGreaterThan(before)
 expect(g.sent.filter(message=>message.personalizations[0].to[0].email===update.personalizations[0].to[0].email).length).toBeGreaterThan(1)
 await accepted(call('/api/operator/settings/business',{companyName:input.companyName,postalAddress:input.postalAddress,confirmPostalAddress:true},g.operator,'PUT'))
 await accepted(call('/api/operator/settings/weekly-summary',{enabled:true},g.operator,'PUT'))
 expect(await (await accepted(call('/api/operator/settings/weekly-summary',undefined,g.operator))).json()).toMatchObject({enabled:true})
 await proveReleaseMailIdentity()
})
