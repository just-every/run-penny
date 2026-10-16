import { Field,LoopForm } from '@/core/app/ui/loop-form'
import { EvidenceRecorder } from '@/core/features/evidence/ui/evidence-actions'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import type { OperatorEvidenceCard } from '@/core/shared/api/operator'
import type { OperatorPage } from '@/core/features/workspace/list-query'
import type { LearningHome } from './types'
import { api,evidenceSource,stateLabel } from './types'
import { CurrencyField } from './learning-protocol'

export function LearningCapture({home,onSaved}:{home:LearningHome;onSaved:()=>void}) {
 const [evidence,reload]=useOperatorResource<OperatorPage<OperatorEvidenceCard>>('/api/operator/evidence')
 const saved=()=>{reload();onSaved()}
 return <section className="capture" aria-labelledby="capture-heading"><h2 id="capture-heading" tabIndex={-1}>Capture deliberately. Give Penny a narrow remit.</h2>
 <p className="quiet">Use original customer feedback already recorded in Penny, or explicitly selected sales records. Sources stay private to your operators.</p>
 <details><summary>Record native feedback</summary><EvidenceRecorder onSaved={saved}/></details>
{/* Sales records and interpretation reach other services through a deployment
  relay; where it is missing the page says so plainly instead of showing forms. */}
 {home.configuration.source||home.configuration.model?null:<p role="status" className="quiet">Learning from sales records and AI interpretation are not available on this installation. They need an AI model key and an outbound connection relay for Penny’s server, and no Penny hosting offers that relay yet, self-hosted or Managed. Recording feedback above works now, and so does the rest of Penny.</p>}
 {home.configuration.source?<> <details><summary>Connect selected Orbit sales evidence</summary>
 <LoopForm title="Grant a source" action={`${api}/sources`} submit="Connect selected records" onSaved={onSaved} transform={d=>({name:d.get('name'),provider:'orbit',resourceIds:String(d.get('resourceIds')).split(/[,\n]/).map(s=>s.trim()).filter(Boolean),useBasis:d.get('useBasis'),allOperatorsAuthorized:d.get('authorized')==='on'})}>
 <Field name="name" label="Source name" required/><Field name="resourceIds" label="Orbit records to share (one per line: the ID shown on each record in Orbit)" required type="textarea"/><Field name="useBasis" label="Permission and permitted use" required type="textarea"/>
 <label><input name="authorized" type="checkbox" required/> All Penny operators may inspect these selected records and their derived learning.</label>
 <p>Reading and internal interpretation only. This does not authorize contacting customers, publishing, or changing production.</p></LoopForm></details></>:null}
 {home.configuration.model?<> <details><summary>Start a bounded investigation</summary>
 <LoopForm title="Authorize learning" action={`${api}/investigations`} submit="Start learning" onSaved={onSaved} disabled={evidence.kind!=='ready'} transform={d=>({...(d.get('sourceId')?{sourceId:d.get('sourceId')}:{}),question:d.get('question'),nativeEvidenceIds:d.getAll('nativeEvidenceIds'),nativeRequestIds:[],purpose:d.get('purpose'),expiresAt:new Date(String(d.get('expiresAt'))).toISOString(),budgetMicros:Math.round(Number(d.get('budget'))*1e6),maxRunCostMicros:Math.round(Number(d.get('maxRunCost'))*1e6),intervalMinutes:Number(d.get('intervalMinutes'))})}>
 <Field name="question" label="Question to resolve (optional: Penny proposes one)"/>
 <Field name="sourceId" label="Connected source (optional)" choices={home.sources.filter(s=>s.state==='active').map(s=>({id:s.id,label:s.name}))}/>
 <fieldset><legend>Select native evidence</legend>{evidence.kind==='ready'?evidence.data.items.map(e=><label key={e.id} className="block py-2"><input type="checkbox" name="nativeEvidenceIds" value={e.id}/> {evidenceSource(e.sourceType,e.sourceLabel)}: “{e.wording}”</label>):<p role="status">{evidence.kind==='loading'?'Loading evidence…':'Evidence could not be loaded.'} <button type="button" onClick={reload}>Reload evidence</button></p>}{evidence.kind==='ready'&&!evidence.data.items.length?<p>Record feedback first, or select a connected source.</p>:null}</fieldset>
 <Field name="purpose" label="Purpose and scope" required type="textarea"/>
 <div className="form-grid"><Field name="expiresAt" label="Grant expiry" type="datetime-local" required/><Field name="intervalMinutes" label="Check interval (minutes)" type="number" value="1440" required/><CurrencyField name="budget" label="Total spend limit (USD)"/><CurrencyField name="maxRunCost" label="Maximum check cost (USD)"/></div>
 <p>Effects: read the selected evidence and prepare internal interpretations, comparable options and a measurement plan. Actual model spend is charged to this grant. At expiry or the spend limit, affected work stops.</p>
 </LoopForm></details></>:null}
 <details id="learning-source-permissions"><summary>Sources, permission and erasure</summary>{home.sources.length?home.sources.map(s=><div key={s.id} id={`learning-source-${s.id}`} className="source-row"><h3 tabIndex={-1}>{s.name} · {stateLabel(s.state)}</h3><p>{s.useBasis}</p><p>Selected records: {s.resourceIds.join(', ')}</p><LoopForm title={`Disconnect ${s.name}`} action={`${api}/sources/${s.id}/disconnect`} submit="Disconnect and purge" onSaved={onSaved} transform={()=>({})} disabled={s.state!=='active'}><p>Revokes access and purges copied records and dependent learning. Native originals remain in Penny.</p></LoopForm>{s.provider==='orbit'?<details><summary>Erase a source person's contribution</summary><LoopForm title={`Erase source contribution from ${s.name}`} action={`${api}/sources/${s.id}/erase-person`} onSaved={onSaved} submit="Erase contribution"><Field name="sourcePersonId" label="Source person ID" required/><p>Removes this person's copies and dependent investigation history, and prevents replay.</p></LoopForm></details>:s.provider==='native'?<p>To erase a native person and their contributions, open <a href="/app/data">Data</a> and preview their personal data erasure. Disconnecting this source leaves native originals in Penny.</p>:null}</div>):<p className="quiet">No external source grants.</p>}</details>
 </section>
}
