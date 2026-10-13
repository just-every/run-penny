import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {setTimeout as delay} from 'node:timers/promises'

const checkpoints=new WeakMap()
const manifest=JSON.parse(await readFile(new URL('../../seed.json',import.meta.url),'utf8'))

/** The review repeatedly hard-loads whole asset graphs faster than a person.
 * Keep the real cache, client identity, session and limiter intact. Reserve half
 * the actual allowance for the next document's asset burst; a larger burst or
 * any unexpected refusal still fails the journey's existing assertions.
 * Only navigation methods are paced, never network requests or mutations. */
export async function pacePublicContext(context,runtime,clientIp) {
 const subject=createHash('sha256').update(clientIp).digest('hex')
 const allowance=manifest.limits.publicReadRequestsPerMinutePerIp
 const reserve=Math.ceil(allowance/2)
 assert.ok(Number.isSafeInteger(allowance)&&allowance>0)
 const checkpoint=async()=>{
  const row=await runtime.db.prepare('SELECT count,expires_at FROM penny_public_admission WHERE scope=? AND subject_hash=?').bind('public_entry',subject).first()
  if(!row||row.count+reserve<=allowance)return
  const waitMs=Date.parse(row.expires_at)-Date.now()
  assert.ok(Number.isFinite(waitMs),'Public admission has a valid real window')
  if(waitMs>0){
   console.log(`public-entry pacing: ${row.count}/${allowance} admitted; waiting ${waitMs}ms before navigation`)
   await delay(waitMs+25)
  }
 }
 checkpoints.set(context,checkpoint)
 const attach=page=>{
  for(const method of ['goto','reload','goBack','goForward']){
   const navigate=page[method].bind(page)
   page[method]=async(...args)=>{await checkpoint();return navigate(...args)}
  }
 }
 for(const page of context.pages())attach(page)
 context.on('page',attach)
}

/** Give the next UI phase the same headroom without replaying its actions. */
export async function pacePublicPhase(page) {
 await checkpoints.get(page.context())?.()
}
