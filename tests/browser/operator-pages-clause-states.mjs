import assert from 'node:assert/strict'

async function bounded(work,label,details){
 let timer
 try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out: ${details()}`)),30_000)})])}
 finally{clearTimeout(timer)}
}

/** Discard the document before aborting a pending request. Keep interception
 * alive until the abort finishes: closing the page first can remove its route
 * handler and forward the held request to the real Worker. */
function networkFault({target,item,state,requests,errors,pending}){
 let release,entered,disposing=false
 const held=new Promise(resolve=>{release=resolve}),requestEntered=new Promise(resolve=>{entered=resolve})
 const running=new Set()
 const status=state==='expired'?401:500
 const details=()=>JSON.stringify({path:item.path,state,requests:requests.length,routes:running.size,errors})
 const intercept=async route=>{
  if(item.method&&route.request().method()!==item.method){await route.continue();return}
  requests.push(route.request().url());entered()
  const completion=(async()=>{
   try{
    if(state===pending){await held;assert.ok(disposing,'A held fault only releases during document teardown');await route.abort();return}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(item.method?status===401?{authenticated:false}:{}:{error:state==='expired'?'unauthenticated':'test_only_read_failure'})})
   }catch(error){errors.push(`Network fault handler: ${error.message}`)}
  })()
  running.add(completion)
  try{await completion}finally{running.delete(completion)}
 }
 return {
  intercept,
  entered:()=>bounded(requestEntered,`${item.name} ${state} request entry`,details),
  close:async()=>{
   disposing=true
   try{if(running.size)await bounded(target.goto('about:blank'),`${item.name} ${state} document teardown`,details)}
   finally{
    release()
    try{await bounded(Promise.all([...running]),`${item.name} ${state} route teardown`,details)}
    finally{await bounded(target.close(),`${item.name} ${state} page close`,details)}
   }
  },
 }
}
/** Deliberate network-edge faults exercise the real mounted feature screens. */
export async function reviewClauseStates({page,capture}){
 const origin=new URL(page.url()).origin
 const get=async path=>{const response=await page.request.get(origin+path);assert.equal(response.status(),200);return response.json()}
 const evidence=await get('/api/operator/evidence')
 const cases=[
  {name:'EVID-007-operator-suggestions',path:'/api/operator/requests/suggestions?title=onboarding',page:'/app/feedback',prepare:async target=>target.getByLabel('Find related requests',{exact:true}).fill('onboarding'),loading:'Finding similar requests…',failure:'Could not find similar requests.'},
  {name:'NOTIFY-003-notifications',path:'/api/operator/notifications',page:'/app/overview',open:'Review notifications',loading:'Loading review notifications…',failure:'Could not load review notifications.'},
  ...evidence.slice(0,1).flatMap(item=>[
   {name:'EVID-010-wording-history',path:`/api/operator/evidence/${item.id}/versions`,page:'/app/feedback',open:'Wording history and private files',loading:'Loading wording history…',failure:'Could not load wording history.'},
   {name:'EVID-008-attachments',path:`/api/operator/evidence/${item.id}/attachments`,page:'/app/feedback',open:'Wording history and private files',loading:'Loading private attachments…',failure:'Could not load private attachments.'},
  ]),
  {name:'DEC-006-history',path:'/api/operator/decisions/attention-decision/history',page:'/app/decisions/attention-decision',loading:'Loading commitment history…',failure:'Could not load commitment history.'},
  {name:'DEC-008-post-release',path:'/api/operator/decisions/attention-decision/post-release',page:'/app/decisions/attention-decision',loading:'Loading post-release evidence…',failure:'Could not load post-release evidence.'},
 ]
 for(const item of cases)for(const state of ['loading','failed','expired']){
  const target=await page.context().newPage(),errors=[],diagnostics=[],requests=[]
  const status=state==='expired'?401:500
  target.on('pageerror',error=>errors.push(error.message))
  target.on('request',request=>{if(new URL(request.url()).origin!==origin)errors.push('External request')})
  target.on('console',message=>{if(message.type()!=='error')return;const reason=status===401?'Unauthorized':'Internal Server Error';if(message.location().url===origin+item.path&&message.text()===`Failed to load resource: the server responded with a status of ${status} (${reason})`)diagnostics.push(status);else errors.push(message.text())})
  const fault=networkFault({target,item,state,requests,errors,pending:'loading'})
  const details=()=>JSON.stringify({path:item.path,state,requests:requests.length,errors})
  await target.route(origin+item.path,fault.intercept)
  try{
   // The server document already contains this input. A successful mounted
   // auxiliary read proves hydration before fill dispatches the input event.
   const mounted=item.prepare?target.waitForResponse(origin+'/api/operator/loop/options',{timeout:30_000}):null
   mounted?.catch(()=>{})
   await target.goto(origin+item.page,{waitUntil:'domcontentloaded'})
   if(item.prepare){const response=await mounted;assert.equal(response.status(),200,'The mounted evidence form loads its real options');assert.equal(await bounded(response.finished(),`${item.name} ${state} mounted options`,details),null);await item.prepare(target)}
   await fault.entered()
   if(item.open){const summary=target.locator('summary').filter({hasText:item.open}).first();await summary.click()}
   await target.getByText(state==='loading'?item.loading:state==='failed'?item.failure:'Your operator session has expired.',{exact:true}).first().waitFor()
   await bounded(capture(`${item.name}-${state}`,target),`${item.name} ${state} capture`,details)
   assert.equal(requests.length,1,`[BASE-OPS-004] ${item.name} ${state} uses one read`)
   assert.deepEqual(errors,[],`[BASE-OPS-004] ${item.name} no unexpected diagnostics`)
   assert.ok(diagnostics.length<=1)
  }finally{await fault.close();assert.deepEqual(errors,[],`[BASE-OPS-004] ${item.name} ${state} teardown has no unexpected diagnostics`)}
 }
 await reviewMutationStates({page,capture,origin,evidence:evidence[0]})
}

/** Only the network edge supplies failures; no mutation reaches the local store. */
async function reviewMutationStates({page,capture,origin,evidence}){
 assert.ok(evidence,'[EVID-008][EVID-010] mutation states use an existing operator evidence item')
 const base=`/api/operator/evidence/${evidence.id}`
 const stored=async path=>{const response=await page.request.get(origin+path);assert.equal(response.status(),200);return response.json()}
 const before=await Promise.all([stored(base+'/versions'),stored(base+'/attachments')])
 const uploadId='network-edge-interrupted-upload'
 const cases=[
  {name:'EVID-010-wording-save',path:base+'/wording',method:'PATCH',form:'Edit evidence wording',submit:'Save new version',pending:'Saving…',failure:'Could not save.',prepare:async form=>form.getByLabel('Evidence wording',{exact:true}).fill('Unsaved wording remains in the editor.')},
  {name:'EVID-008-file-upload',path:base+'/attachments',method:'POST',form:'Attach evidence file',submit:'Attach private file',pending:'Uploading…',failure:'File upload failed.',prepare:async form=>form.getByLabel('Evidence file',{exact:true}).setInputFiles({name:'private-note.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nPrivate note\n%%EOF')})},
  {name:'EVID-008-upload-recovery',path:`/api/operator/evidence-uploads/${uploadId}/recover`,method:'POST',form:'Recover evidence upload',submit:'Recover upload',pending:'Recovering…',failure:'Upload recovery failed. Keep the original file and retry.',recovery:true},
 ]
 for(const item of cases)for(const state of ['pending','failed','expired']){
  const target=await page.context().newPage(),errors=[],diagnostics=[],requests=[]
  const status=state==='expired'?401:500
  const consoleError=message=>{
   if(message.type()!=='error')return
   const reason=status===401?'Unauthorized':'Internal Server Error'
   if(message.location().url===origin+item.path&&message.text()===`Failed to load resource: the server responded with a status of ${status} (${reason})`)diagnostics.push(status)
   else errors.push(message.text())
  }
  target.on('console',consoleError)
  target.on('pageerror',error=>errors.push(error.message))
  target.on('request',request=>{if(new URL(request.url()).origin!==origin)errors.push('External request')})
  const fault=networkFault({target,item,state,requests,errors,pending:'pending'})
  const details=()=>JSON.stringify({path:item.path,state,requests:requests.length,errors})
  if(item.recovery){
   // Fault fixture at the read edge exposes the recovery form; this proves UI states, not upload custody.
   await target.route(origin+base+'/attachments',async route=>{
    const response=await route.fetch(),attachments=await response.json()
    assert.equal(response.status(),200)
    await route.fulfill({response,json:{...attachments,uploads:[{id:uploadId,filename:'interrupted-private-note.pdf',writing:0}]}})
   })
  }
  await target.route(origin+item.path,fault.intercept)
  try{
   await target.goto(origin+'/app/feedback',{waitUntil:'domcontentloaded'})
   const card=target.locator(`#evidence-${evidence.id}`)
   await card.getByText('Wording history and private files',{exact:true}).click()
   const form=card.getByRole('form',{name:item.form,exact:true})
   await form.waitFor()
   if(item.prepare)await item.prepare(form)
   await form.getByRole('button',{name:item.submit,exact:true}).click()
   await fault.entered()
   if(state==='pending'){
    assert.equal(await form.getByRole('button',{name:item.pending,exact:true}).isDisabled(),true)
    assert.equal(await form.getByRole('alert').count(),0,'[BASE-OPS-004] pending mutation has no failure or expiry alert')
   }else{
    await form.getByText(state==='expired'?'Your operator session has expired.':item.failure,{exact:true}).waitFor()
    assert.equal(await form.getByRole('button',{name:item.pending,exact:true}).count(),0,'[BASE-OPS-004] terminal mutation state is distinct from pending')
    assert.equal(await form.getByRole('button',{name:item.submit,exact:true}).isDisabled(),state==='expired')
    assert.equal(await form.getByRole('link',{name:'Sign in now',exact:true}).count(),state==='expired'?1:0,'[BASE-OPS-004] expired session gives the existing sign-in recovery')
    if(state==='expired')assert.equal(await form.getByText(item.failure,{exact:true}).count(),0,'[BASE-OPS-004] 401 is not a generic server failure')
   }
   if(item.method==='PATCH')assert.equal(await form.getByLabel('Evidence wording',{exact:true}).inputValue(),'Unsaved wording remains in the editor.','[EVID-010] failed or pending saves retain the draft')
   if(item.form==='Attach evidence file')assert.equal(await form.locator('input[type=file]').evaluate(input=>input.files.length),1,'[EVID-008] failed or pending uploads retain the selected file')
   await bounded(capture(`${item.name}-${state}`,target),`${item.name} ${state} capture`,details)
   assert.equal(requests.length,1,'[BASE-OPS-004] one submission sends one mutation')
   assert.deepEqual(errors,[],'[BASE-OPS-004] mutation states have no unexpected diagnostics')
   assert.ok(diagnostics.length<=1)
  }finally{
   await fault.close()
   assert.deepEqual(errors,[],'[BASE-OPS-004] mutation teardown has no unexpected diagnostics')
   assert.deepEqual(await Promise.all([stored(base+'/versions'),stored(base+'/attachments')]),before,`[EVID-008][EVID-010] ${item.name} ${state} leaves stored wording and files unchanged`)
  }
 }
 assert.deepEqual(await Promise.all([stored(base+'/versions'),stored(base+'/attachments')]),before,'[EVID-008][EVID-010] network failures and pending cancellations never change stored wording or files')
}
