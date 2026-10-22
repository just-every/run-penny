import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {setTimeout as delay} from 'node:timers/promises'

const checkpoints=new WeakMap()
const manifest=JSON.parse(await readFile(new URL('../../seed.json',import.meta.url),'utf8'))

/** Reserve half the live read allowance for the next navigation and hydration.
 * Wait only after that reserve is spent; keep the real client, cache and limiter.
 * Requests and mutations are never intercepted or replayed. */
export async function pacePublicContext(context,runtime,clientIp) {
 const subject=createHash('sha256').update(clientIp).digest('hex')
 const allowance=manifest.limits.publicReadRequestsPerMinutePerIp
 assert.ok(Number.isSafeInteger(allowance)&&allowance>0)
 const checkpoint=async(page,action)=>{
  for(;;){
   const row=await runtime.db.prepare('SELECT count,expires_at FROM penny_public_admission WHERE scope=? AND subject_hash=?').bind('public_entry',subject).first()
   if(!row||row.count<allowance/2)return
   const waitMs=Date.parse(row.expires_at)-Date.now()
   assert.ok(Number.isFinite(waitMs),'Public admission has a valid real window')
   if(waitMs<=0)return
   console.log(`public-entry pacing: width=${page.viewportSize()?.width??'unset'} ${row.count}/${allowance} admitted; waiting ${waitMs}ms before ${action}`)
   await delay(waitMs+25)
   // A request already in flight can open another window while we wait. Read
   // the actual bucket again; never reset it or replay the pending navigation.
  }
 }
 checkpoints.set(context,checkpoint)
 const attach=page=>{
  for(const method of ['goto','reload','goBack','goForward']){
   const navigate=page[method].bind(page)
   page[method]=async(...args)=>{await checkpoint(page,method);return navigate(...args)}
  }
 }
 for(const page of context.pages())attach(page)
 context.on('page',attach)
}

/** Give the next UI phase a fresh window without replaying its actions. */
export async function pacePublicPhase(page) {
 await checkpoints.get(page.context())?.(page,'UI phase')
}
