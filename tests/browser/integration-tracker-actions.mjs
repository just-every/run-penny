import assert from 'node:assert/strict'

export async function checkTrackerActions({runtime,page,action,subject,capture,edge,teamId,organizationId,secret}){
 await runtime.configure({},{worker:edge.worker,binding:'PENNY_EGRESS'})
 const owner=await runtime.db.prepare('SELECT id FROM operators LIMIT 1').first('id')
 const decision=await action('/api/operator/decisions',{question:'synthetic-penny-private planning question',ownerOperatorId:owner})
 await action(`/api/operator/requests/${subject.slug}/notes`,{body:'synthetic-penny-private negotiation note'})
 await action('/api/operator/accounts',{name:'synthetic-penny-private customer',internalOwnerId:owner,revenueCents:4800000,health:'Renewal is private',renewalDate:'2027-03-15'})
 for(const provider of ['linear','jira'])for(const kind of ['request','decision']){
  const selected=kind==='request'?{requestId:subject.id}:{decisionId:decision.id}
  const connection=await action('/api/operator/integrations/trackers/connections',{name:`${provider} ${kind} actions`,provider,projectIdentity:provider==='linear'?teamId:'10200',organizationIdentity:provider==='linear'?organizationId:'',siteOrigin:provider==='jira'?'https://penny-fixture.atlassian.net':'',issueType:provider==='jira'?'10001':'',apiEmail:provider==='jira'?['operator','example.test'].join('@'):'',apiToken:'synthetic-penny-tracker-api-1',signingKey:secret})
  const known=()=>({...selected,connectionId:connection.id,externalId:provider==='linear'?crypto.randomUUID():'10044',url:provider==='linear'?'https://linear.app/penny/issue/PEN-44/known-outcome':'https://penny-fixture.atlassian.net/browse/PEN-44'})
  const snapshot=async()=>{
   const rows={}
   for(const table of ['penny_tracker_links','penny_tracker_commands','integration_deliveries','integration_attempts','integration_resolutions'])rows[table]=(await runtime.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()).results
   return rows
  }
  const reconcile=(commandId,input)=>page.request.post(runtime.origin+`/api/operator/integrations/trackers/commands/${commandId}/reconcile`,{headers:{Origin:runtime.origin},data:input})
  const refuse=async(commandId,input,state)=>{
   const before=await snapshot(),response=await reconcile(commandId,input)
   assert.equal(response.status(),409,`[INT-005] ${state} commands refuse known-issue reconciliation`)
   assert.deepEqual(await snapshot(),before,`[INT-005] ${state} refusal changes no link, command, delivery or history`)
   const read=await page.request.get(runtime.origin+'/api/operator/integrations/trackers')
   assert.equal(read.status(),200)
   assert.equal((await read.json()).commands.find(row=>row.id===commandId).state,state,'[INT-005] native readback retains the refused command state')
  }
  const visit=async()=>{
   await page.goto(runtime.origin+(kind==='request'?'/app/moderation':'/app/decisions/'+decision.slug));await page.waitForLoadState('networkidle')
   if(kind==='request')await page.locator('article').filter({has:page.getByRole('heading',{name:'Deliberate tracker subject',exact:true})}).getByText('Discussion, status and request controls',{exact:true}).click()
  }
  await visit()
  const panel=kind==='request'?page.locator('article').filter({has:page.getByRole('heading',{name:'Deliberate tracker subject',exact:true})}):page.getByRole('region',{name:'Create or link a tracker issue',exact:true})
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
   if(!unknown)assert.deepEqual(await form.locator('input[name="title"],textarea[name="description"]').evaluateAll(nodes=>nodes.map(node=>node.value)),['',''],'[INT-005] private source wording is not prefilled into the entered-only action')
   const title=`Entered ${provider} ${kind} ${unknown?'uncertain':'accepted'} title`,description='Entered public implementation wording'
   edge.expected.set(provider,provider==='linear'?{query:'mutation PennyIssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id title url team { id } } } }',variables:{input:{teamId,title,description}}}:{fields:{project:{id:'10200'},issuetype:{id:'10001'},summary:title,description:{version:1,type:'doc',content:[{type:'paragraph',content:[{type:'text',text:description}]}]}}})
   edge.uncertain(unknown)
   await form.getByLabel('Issue title',{exact:true}).fill(title);await form.getByLabel('Issue description',{exact:true}).fill(description)
   await form.getByRole('button',{name:'Create tracker issue',exact:true}).click();await panel.getByText('Create command saved. Its receipt shows the durable result.',{exact:true}).waitFor()
   const command=await runtime.db.prepare('SELECT * FROM penny_tracker_commands WHERE connection_id=? ORDER BY created_at DESC,id DESC LIMIT 1').bind(connection.id).first()
   const before=edge.calls.length
   if(!unknown){
    await refuse(command.id,known(),'queued')
    const paused=edge.pause(),drain=runtime.schedule()
    try{
     await Promise.race([paused.entered,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Tracker edge did not receive the sending command')),15000);timer.unref()})])
     await refuse(command.id,known(),'sending')
    }finally{paused.resume();await drain}
   }else await runtime.schedule()
   assert.equal(edge.calls.length,before+1,'[INT-005] one deliberate native create reaches the provider edge')
   assert.equal(edge.calls.at(-1).id,command.id,'[INT-005] outbound create uses its durable command identity')
   const state=()=>runtime.db.prepare('SELECT state FROM integration_deliveries WHERE id=?').bind(command.id).first('state')
   assert.equal(await state(),unknown?'uncertain':'accepted','[INT-005] provider outcome is durably retained')
   await page.waitForLoadState('networkidle');await runtime.restart();await runtime.schedule();await visit()
   assert.equal(edge.calls.length,before+1,'[INT-005] restart and Cron never duplicate the create')
   if(unknown){
    const receipt=panel.locator('li').filter({has:page.getByRole('button',{name:'Reconcile known issue',exact:true})})
    const issue=known(),uncertain=await snapshot()
    await runtime.db.exec("CREATE TRIGGER synthetic_penny_reconcile_failure BEFORE UPDATE ON integration_deliveries WHEN OLD.namespace='penny-trackers' AND OLD.state='uncertain' AND NEW.state='accepted' BEGIN SELECT RAISE(ABORT,'synthetic late reconciliation failure'); END")
    try{assert.equal((await reconcile(command.id,issue)).status(),503,'[INT-005] late storage failure refuses reconciliation')}
    finally{await runtime.db.exec('DROP TRIGGER synthetic_penny_reconcile_failure')}
    assert.deepEqual(await snapshot(),uncertain,'[INT-005] a late failure rolls back the issue link, command, delivery and resolution together')
    await receipt.getByLabel('Known issue ID',{exact:true}).fill(issue.externalId)
    await receipt.getByLabel('Known issue HTTPS URL',{exact:true}).fill(issue.url)
    await capture(`tracker-${provider}-${kind}-uncertain`,kind==='request'?form.locator('..'):panel)
    await receipt.getByRole('button',{name:'Reconcile known issue',exact:true}).click();await panel.getByText('Known issue reconciled. No new create was sent.',{exact:true}).waitFor()
    const reconciled=await snapshot(),repeat=await action(`/api/operator/integrations/trackers/commands/${command.id}/reconcile`,issue)
    assert.equal(repeat.id,await runtime.db.prepare('SELECT link_id FROM penny_tracker_commands WHERE id=?').bind(command.id).first('link_id'),'[INT-005] repeating a known reconciliation returns the same issue link')
    assert.deepEqual(await snapshot(),reconciled,'[INT-005] identical reconciled replay preserves the original link and all history')
    const different={...issue,externalId:provider==='linear'?crypto.randomUUID():'10045',url:provider==='linear'?'https://linear.app/penny/issue/PEN-45/different-issue':'https://penny-fixture.atlassian.net/browse/PEN-45'}
    await refuse(command.id,different,'accepted')
    await page.waitForLoadState('networkidle');await runtime.restart();await runtime.schedule();await runtime.schedule();await visit()
    assert.deepEqual({state:await state(),resolutions:await runtime.db.prepare('SELECT count(*) n FROM integration_resolutions WHERE delivery_id=?').bind(command.id).first('n'),calls:edge.calls.length},{state:'accepted',resolutions:1,calls:before+1},'[INT-005] explicit reconciliation resolves exactly once without another create')
    assert.equal(await panel.getByRole('button',{name:'Reconcile known issue',exact:true}).count(),0,'[INT-005] resolved commands no longer offer reconciliation')
   }else{
    assert.ok(await runtime.db.prepare('SELECT 1 FROM penny_tracker_links WHERE id=? AND state=\'created\'').bind(command.link_id??(await runtime.db.prepare('SELECT link_id FROM penny_tracker_commands WHERE id=?').bind(command.id).first('link_id'))).first(),'[INT-005] accepted create links its returned issue')
   }
   await capture(`tracker-${provider}-${kind}-${unknown?'reconciled':'created'}`,kind==='request'?form.locator('..'):panel)
  }
  const rejectedTitle=`Entered ${provider} ${kind} rejected title`,rejectedDescription='Entered rejected implementation wording'
  edge.expected.set(provider,provider==='linear'?{query:'mutation PennyIssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id title url team { id } } } }',variables:{input:{teamId,title:rejectedTitle,description:rejectedDescription}}}:{fields:{project:{id:'10200'},issuetype:{id:'10001'},summary:rejectedTitle,description:{version:1,type:'doc',content:[{type:'paragraph',content:[{type:'text',text:rejectedDescription}]}]}}})
  const rejected=await action('/api/operator/integrations/trackers/create',{...selected,connectionId:connection.id,title:rejectedTitle,description:rejectedDescription,operationKey:crypto.randomUUID()})
  edge.reject(true)
  try{await runtime.schedule()}finally{edge.reject(false)}
  await refuse(rejected.id,known(),'rejected')
  const settled=await snapshot(),calls=edge.calls.length
  await runtime.restart();await runtime.schedule();await runtime.schedule()
  assert.deepEqual(await snapshot(),settled,'[INT-005] terminal command custody survives restart and repeated scheduler drains')
  assert.equal(edge.calls.length,calls,'[INT-005] accepted reconciliation and rejected commands never create again')
 }
 return 16
}
