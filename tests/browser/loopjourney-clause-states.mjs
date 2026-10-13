import assert from 'node:assert/strict'
import { createAudit } from './acceptance-audit.mjs'

async function bounded(work,label,details){
 let timer
 try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out: ${details()}`)),30_000)})])}
 finally{clearTimeout(timer)}
}

// Start's default development client uses StrictMode. A mount effect can issue
// a read, abort it during cleanup, and issue its replay; neither is a prefetch.
const mountReadLimit=2

/** A held loading read is cancelled only after its document has closed. */
function networkFault({page,item,state,status,origin}){
 let release,entered,disposing=false,enteredCount=0
 const held=new Promise(resolve=>{release=resolve}),requestEntered=new Promise(resolve=>{entered=resolve})
 const running=new Set(),errors=[]
 const details=()=>JSON.stringify({path:item.path,state,requests:enteredCount,routes:running.size,errors:errors.map(error=>error.message)})
 const intercept=async route=>{
  enteredCount++;entered()
  const completion=(async()=>{
   try{
    assert.equal(route.request().url(),origin+item.path,'Clause faults intercept the exact resource URL only')
    assert.equal(route.request().method(),'GET','Clause faults intercept auxiliary reads only')
    assert.equal(route.request().isNavigationRequest(),false,'Clause faults never intercept document admission')
    assert.ok(enteredCount<=mountReadLimit,'Clause faults permit only the initial mount and its development replay')
    if(state==='loading'){await held;assert.ok(disposing,'A held fault only releases during document teardown');await route.abort()}
    else await route.fulfill({status,contentType:'application/json',body:JSON.stringify({error:state==='expired'?'unauthenticated':'test_only_read_failure'})})
   }catch(error){errors.push(error)}
  })()
  running.add(completion)
  try{await completion}finally{running.delete(completion)}
 }
 return {
  intercept,details,requests:()=>enteredCount,
  entered:()=>bounded(requestEntered,`${item.name} ${state} request entry`,details),
  check:()=>{
   assert.ok(enteredCount>=1&&enteredCount<=mountReadLimit,`[BASE-OPS-004] ${item.name} ${state} faults the bounded mount reads`)
   assert.deepEqual(errors,[],`[BASE-OPS-004] ${item.name} ${state} fault handler has no unexpected errors`)
  },
  close:async()=>{
   disposing=true
   const failures=[]
   try{await bounded(page.close(),`${item.name} ${state} page close`,details)}catch(error){failures.push(error)}
   release()
   try{await bounded(Promise.all([...running]),`${item.name} ${state} route teardown`,details)}catch(error){failures.push(error)}
   if(failures.length)throw new AggregateError(failures,'Clause fault teardown failed')
  },
 }
}

/** Reuse the normal audit on isolated sessions so expected failures stay bounded. */
export async function clauseScreenStates({browser,operator,requester,origin,output,viewport,releaseSlug}){
 const path=`/api/operator/releases/${releaseSlug}`
 const cases=[
  {name:'EVID-007-requester-suggestions',path:'/api/public/requests/suggestions?title=onboarding',document:'/portal/feedback/new',prepare:async page=>page.getByLabel('Title',{exact:true}).fill('onboarding'),loading:'Finding similar feedback…',failure:'Could not load similar feedback.',states:['loading','failed']},
  {name:'REL-003-versions',path:path+'/versions',document:`/app/releases/${releaseSlug}`,loading:'Loading release versions…',failure:'Could not load release versions.',operator:true},
  {name:'REL-009-coverage',path:path+'/outcomes',document:`/app/releases/${releaseSlug}`,loading:'Loading outcome coverage…',failure:'Could not load outcome coverage.',operator:true},
  {name:'REL-012-subscription',path:'/api/public/updates/subscription',document:'/portal/updates',loading:'Loading update permission…',failure:'Update permission could not be loaded.',expired:'Verify your email from Submit feedback to manage product updates.'},
  {name:'REL-008-outcomes',path:`/api/public/releases/${releaseSlug}/outcomes`,document:`/portal/updates/${releaseSlug}`,loading:'Loading your outcome responses…',failure:'Could not load your outcomes.',expired:'Your verified session is needed to answer. Verify your email from Submit feedback.'},
 ]
 for(const item of cases)for(const state of item.states??['loading','failed','expired']){
  const context=await browser.newContext({viewport,storageState:await (item.operator?operator:requester).context().storageState()})
  const status=state==='expired'?401:500
  const audit=await createAudit(context,origin,output,viewport,{expectedHttpErrors:state==='loading'?[]:[{path:item.path,status,minCount:1,maxCount:mountReadLimit}]})
  const page=await context.newPage()
  const fault=networkFault({page,item,state,status,origin}),failures=[]
  try{
   await page.route(origin+item.path,fault.intercept)
   // This direct mount effect is not a prefetched resource. Its successful
   // response proves the verified requester form has hydrated before input.
   const mounted=item.prepare?page.waitForResponse(origin+'/api/public/identity/session',{timeout:30_000}):null
   mounted?.catch(()=>{})
   await page.goto(origin+item.document,{waitUntil:'domcontentloaded'})
   if(item.prepare){const response=await mounted;assert.equal(response.status(),200,'The mounted requester form validates its real session');assert.equal(await bounded(response.finished(),`${item.name} ${state} mounted session`,fault.details),null);await item.prepare(page)}
   await fault.entered()
   const labels={loading:item.loading,failed:item.failure,expired:item.expired??'Your operator session has expired.'}
   await page.getByText(labels[state],{exact:false}).first().waitFor()
   for(const [other,label] of Object.entries(labels))if(other!==state)assert.equal(await page.getByText(label,{exact:false}).count(),0,`[BASE-OPS-004] ${item.name} ${state} is distinct from ${other}`)
   await bounded(audit.audit(page,`${item.name}-${state}`),`${item.name} ${state} capture`,fault.details)
   fault.check()
  }catch(error){failures.push(error)}
  finally{
   try{await fault.close()}catch(error){failures.push(error)}
   try{await bounded(context.close(),`${item.name} ${state} context close`,fault.details)}catch(error){failures.push(error)}
   try{fault.check()}catch(error){failures.push(error)}
  }
  if(failures.length)throw new AggregateError(failures,`${item.name} ${state} clause state failed; original and teardown failures retained`)
  await bounded(audit.finish(`${item.name}-${state}`,{scope:'Test-only network-edge fault on the real feature document; current native/requester session copied in memory.',readFault:{path:item.path,state,status:state==='loading'?null:status,requests:fault.requests(),mountReadLimit}}),`${item.name} ${state} audit finish`,fault.details)
 }
}
