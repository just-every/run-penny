import type {PennyRuntime} from '@/core/app/runtime'
import {guardedDatabase} from '../integrations/guarded-database'

/** Reconstruct pre-upgrade failure custody only at idle runtime. The schema
 * migration stays additive for older-archive replay. Existing failures already
 * had their opportunity to notify: their reconstructed episode is quiet until
 * resolution and the next genuine episode. No authority or delivery is restored. */
export async function initializeConnectorEpisodes(runtime:PennyRuntime){
 const raw=runtime.database.binding,state=await raw.prepare("SELECT epoch FROM data_state WHERE singleton=1 AND phase='idle'").first<{epoch:number}>()
 if(!state)return
 const db=guardedDatabase(raw,{sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?)",params:[state.epoch]})
 for(const provider of ['teams','discord'] as const){
  const settings='penny_'+provider+'_settings',jobs='penny_'+provider+'_jobs',sources='penny_'+provider+'_sources'
  // All three statements share one transaction. Normal failure triggers may
  // have established an episode already; that episode and its alert stay intact.
  await db.batch([
   db.prepare(`INSERT OR IGNORE INTO penny_connector_episodes(connector_key,episode_id,operator_id,announce,state,opened_at)
    SELECT ?,lower(hex(randomblob(16))),s.actor_id,0,'active',s.updated_at FROM ${settings} s
    JOIN operators o ON o.id=s.actor_id WHERE s.singleton=1 AND
    (EXISTS(SELECT 1 FROM ${jobs} WHERE state='failed') OR
     EXISTS(SELECT 1 FROM ${sources} WHERE check_failure IS NOT NULL AND check_claim IS NULL))`).bind(provider),
   db.prepare(`INSERT OR IGNORE INTO penny_connector_faults(connector_key,work_key,operator_id,created_at)
    SELECT ?,'capture:'||j.id,s.actor_id,j.updated_at FROM ${jobs} j
    JOIN ${settings} s ON s.singleton=1 JOIN operators o ON o.id=s.actor_id WHERE j.state='failed'`).bind(provider),
   db.prepare(`INSERT OR IGNORE INTO penny_connector_faults(connector_key,work_key,operator_id,created_at)
    SELECT ?,'source:'||j.evidence_id,s.actor_id,s.updated_at FROM ${sources} j
    JOIN ${settings} s ON s.singleton=1 JOIN operators o ON o.id=s.actor_id
    WHERE j.check_failure IS NOT NULL AND j.check_claim IS NULL`).bind(provider),
  ])
 }
}
