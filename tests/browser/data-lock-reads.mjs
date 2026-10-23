import assert from 'node:assert/strict'
import {performance} from 'node:perf_hooks'

/** Sample the actual document throughout an export, including its final verification. */
export function monitorLockReads(runtime,cookie,label) {
 const samples=[],pending=[],errors=[]
 async function read(path='/app/feedback') {
  const start=performance.now(),response=await runtime.call(path,undefined,{Cookie:cookie})
  const sample={label,path,status:response.status,milliseconds:performance.now()-start}
  samples.push(sample)
  assert.equal(sample.status,200,`${label}: ${path} remains readable under the data lock`)
  assert.ok(sample.milliseconds<5000,`${label}: ${path} took ${sample.milliseconds}ms`)
  return response
 }
 const sample=()=>pending.push(read().catch(error=>errors.push(error)))
 sample()
 const timer=setInterval(sample,2000)
 return {read,samples,async stop(){clearInterval(timer);await Promise.all(pending);assert.deepEqual(errors,[],`${label}: every concurrent feedback read succeeds within five seconds`)}}
}

/** Use the app's own destinations, so the lock sweep follows its navigation. */
export async function inspectLockedWorkspace({page,runtime,reads,capture,label}) {
 const document=await page.goto(runtime.origin+'/app/feedback')
 assert.equal(document.status(),200,'Feedback SSR survives the data lock')
 const notice=page.getByRole('status').filter({hasText:'Data changes pause until you finish or abort the export.'})
 await notice.waitFor()
 assert.match(await document.text(),/Data changes pause until you finish or abort the export\./,'The lock notice is server-rendered')
 assert.equal(await notice.locator('button,a').count(),0,'The data notice has no icon-only control')
 const paths=await page.locator('nav[aria-label="Operator workspace"]').first().locator('a').evaluateAll(links=>[...new Set(links.map(link=>link.getAttribute('href')))])
 for(const path of paths)await reads.read(path)
 await capture(label,page,{lockReads:reads.samples})
}
