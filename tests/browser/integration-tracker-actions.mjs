import assert from 'node:assert/strict'

export async function checkTrackerActions({runtime,page,action,subject,capture,edge,teamId,organizationId,secret}){
 await runtime.configure({},{worker:edge.worker,binding:'PENNY_EGRESS'})
 const owner=await runtime.db.prepare('SELECT id FROM operators LIMIT 1').first('id')
 const decision=await action('/api/operator/decisions',{question:'synthetic-penny-private planning question',ownerOperatorId:owner})
 await action(`/api/operator/requests/${subject.slug}/notes`,{body:'synthetic-penny-private negotiation note'})
 await action('/api/operator/accounts',{name:'synthetic-penny-private customer',internalOwnerId:owner,revenueCents:4800000,health:'Renewal is private',renewalDate:'2027-03-15'})
 for(const provider of ['linear','jira'])for(const kind of ['request','decision']){
  const selected=kind==='request'?{requestId:subject.id}:{decisionId:decision.id}
  const connection=await action('/api/operator/integrations/trackers/connections',{name:`${provider} ${kind} actions`,provider,projectIdentity:provider==='linear'?teamId:'10200',organizationIdentity:provider==='linear'?organizationId:'',siteOrigin:provider==='jira'?'https://penny-fixture.atlassian.net':'',issueType:provider==='jira'?'10001':'',apiEmail:provider==='jira'?'operator@example.test':'',apiToken:'synthetic-penny-tracker-api-1',signingKey:secret})
  const visit=async()=>{
   await page.goto(runtime.origin+(kind==='request'?'/app/moderation':'/app/decisions/'+decision.slug));await page.waitForLoadState('networkidle')
   if(kind==='request')await page.locator('article').filter({has:page.getByRole('heading',{name:'Deliberate tracker subject',exact:true})}).getByText('Discussion, status and request controls',{exact:true}).click()
  }
  await visit()
  const panel=kind==='request'?page.locator('article').filter({has:page.getByRole('heading',{name:'Deliberate tracker subject',exact:true})}):page.locator('#tracker-actions')
  const form=panel.getByRole('form',{name:'Tracker issue action',exact:true})
  await form.getByRole('combobox',{name:/^Tracker connection/}).selectOption(connection.id)
  const linkedId=provider==='linear'?crypto.randomUUID():'10043',linkedUrl=provider==='linear'?'https://linear.app/penny/issue/PEN-43/entered-link':'https://penny-fixture.atlassian.net/browse/PEN-43'
  await form.getByLabel('Stable issue ID',{exact:true}).fill(linkedId);await form.getByLabel('HTTPS issue URL',{exact:true}).fill(linkedUrl)
  const sentBefore=edge.calls.length
  await form.getByRole('button',{name:'Link tracker issue',exact:true}).click();await panel.getByText('Issue linked.',{exact:true}).waitFor()
  assert.deepEqual(await runtime.db.prepare('SELECT request_id,decision_id,external_id,issue_url FROM penny_tracker_links WHERE connection_id=?').bind(connection.id).first(),{request_id:selected.requestId??null,decision_id:selected.decisionId??null,external_id:linkedId,issue_url:linkedUrl},'[INT-005] selected provider and subject retain the entered known issue')
  assert.equal(edge.calls.length,sentBefore,'[INT-005] linking a known issue sends no create')
  for(const unknown of [false,true]){
   if(unknown)await panel.getByRole('button',{name:'Start another create',exact:true}).last().click()
   await form.getByRole('combobox',{name:/^Tracker connection/}).selectOption(connection.id)
   await form.getByRole('combobox',{name:/^Tracker action/}).selectOption('create')
   const title=`Entered ${provider} ${kind} ${unknown?'uncertain':'accepted'} title`,description='Entered public implementation wording'
   edge.expected.set(provider,provider==='linear'?{query:'mutation PennyIssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id title url team { id } } } }',variables:{input:{teamId,title,description}}}:{fields:{project:{id:'10200'},issuetype:{id:'10001'},summary:title,description:{version:1,type:'doc',content:[{type:'paragraph',content:[{type:'text',text:description}]}]}}})
   edge.uncertain(unknown)
   await form.getByLabel('Issue title',{exact:true}).fill(title);await form.getByLabel('Issue description',{exact:true}).fill(description)
   await form.getByRole('button',{name:'Create tracker issue',exact:true}).click();await panel.getByText('Create command saved. Its receipt shows the durable result.',{exact:true}).waitFor()
   const command=await runtime.db.prepare('SELECT * FROM penny_tracker_commands WHERE connection_id=? ORDER BY created_at DESC,id DESC LIMIT 1').bind(connection.id).first()
   const before=edge.calls.length
   await runtime.schedule()
   assert.equal(edge.calls.length,before+1,'[INT-005] one deliberate native create reaches the provider edge')
   assert.equal(edge.calls.at(-1).id,command.id,'[INT-005] outbound create uses its durable command identity')
   const state=()=>runtime.db.prepare('SELECT state FROM integration_deliveries WHERE id=?').bind(command.id).first('state')
   assert.equal(await state(),unknown?'uncertain':'accepted','[INT-005] provider outcome is durably retained')
   await runtime.restart();await runtime.schedule();await visit()
   assert.equal(edge.calls.length,before+1,'[INT-005] restart and Cron never duplicate the create')
   if(unknown){
    const receipt=panel.locator('li').filter({has:page.getByRole('button',{name:'Reconcile known issue',exact:true})})
    await receipt.getByLabel('Known issue ID',{exact:true}).fill(provider==='linear'?crypto.randomUUID():'10044')
    await receipt.getByLabel('Known issue HTTPS URL',{exact:true}).fill(provider==='linear'?'https://linear.app/penny/issue/PEN-44/known-outcome':'https://penny-fixture.atlassian.net/browse/PEN-44')
    await capture(`tracker-${provider}-${kind}-uncertain`,panel)
    await receipt.getByRole('button',{name:'Reconcile known issue',exact:true}).click();await panel.getByText('Known issue reconciled. No new create was sent.',{exact:true}).waitFor()
    await runtime.restart();await runtime.schedule();await visit()
    assert.deepEqual({state:await state(),resolutions:await runtime.db.prepare('SELECT count(*) n FROM integration_resolutions WHERE delivery_id=?').bind(command.id).first('n'),calls:edge.calls.length},{state:'accepted',resolutions:1,calls:before+1},'[INT-005] explicit reconciliation resolves exactly once without another create')
    assert.equal(await panel.getByRole('button',{name:'Reconcile known issue',exact:true}).count(),0,'[INT-005] resolved commands no longer offer reconciliation')
   }else{
    assert.ok(await runtime.db.prepare('SELECT 1 FROM penny_tracker_links WHERE id=? AND state=\'created\'').bind(command.link_id??(await runtime.db.prepare('SELECT link_id FROM penny_tracker_commands WHERE id=?').bind(command.id).first('link_id'))).first(),'[INT-005] accepted create links its returned issue')
   }
   await capture(`tracker-${provider}-${kind}-${unknown?'reconciled':'created'}`,panel)
  }
 }
 return 16
}
