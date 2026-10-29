import { getRequest } from '@tanstack/react-start/server'
import { requestContext } from './request-context.server'
import { createPennyRuntime } from './runtime'
import type { Resources, Json } from './resources.server'
import { decisionDatabase } from '@/core/features/decisions/authority'
import { fieldSnapshot } from '@/core/features/settings/field-snapshot'
import { evidenceSnapshot } from '@/core/features/evidence/read-snapshot'
import { roadmapContexts } from '@/core/features/roadmap/read-contexts'
import { requestContexts } from '@/core/features/requests/operator-context'

type Read = (paths:string[])=>Promise<Resources>
type RecordRow = {id:string;slug:string;state?:string}
const result=(data:unknown)=>({status:200,data:data as Json})

/** A fresh, complete route snapshot; no browser or cross-request data cache. */
export async function operatorSnapshot(url:URL, primary:string|undefined, read:Read):Promise<Resources> {
  const path=url.pathname.replace(/\/$/,'')
  if(path==='/app/session-check')return {}
  const paths=['/api/operator/notifications','/api/operator/learning/availability']
  if(path==='/app/feedback')paths.push('/api/operator/data/maintenance')
  if(primary)paths.push(primary)
  if(['/app/feedback','/app/decisions','/app/roadmap','/app/customers','/app/learning'].includes(path)||path.startsWith('/app/decisions/'))paths.push('/api/operator/loop/options')
  if(path==='/app/learning'||path.startsWith('/app/decisions/'))paths.push('/api/operator/evidence')
  if(path==='/app/roadmap')paths.push('/api/operator/evidence?q=&page=1')
  if(path==='/app/moderation')paths.push('/api/operator/settings/request-statuses','/api/public/boards','/api/auth/capabilities','/api/operator/catalog/settings','/api/operator/integrations/trackers')
  if(path.startsWith('/app/decisions/'))paths.push('/api/operator/integrations/trackers')
  if(path==='/app/releases')paths.push('/api/operator/releases/options')
  if(path==='/app/releases'||path==='/app/roadmap'){
    const query=new URLSearchParams({status:'pending'})
    for(const key of ['q','tag','sort','page']){const value=url.searchParams.get(`updates${key[0].toUpperCase()}${key.slice(1)}`);if(value)query.set(key,value)}
    paths.push(`/api/operator/roadmap-updates?${query}`)
  }
  if(path==='/app/settings')paths.push('/api/operator/settings/request-statuses','/api/operator/settings/status-roadmap','/api/operator/settings/operators','/api/operator/settings/custom-fields','/api/operator/settings/branding','/api/operator/settings/frames','/api/operator/integrations/keys','/api/operator/integrations/destinations','/api/operator/integrations/trackers','/api/auth/capabilities')
  const resources=await read([...new Set(paths)])
  const response=primary?resources[primary]:undefined
  if(!response||response.status!==200)return resources
  const data=response.data as unknown as {items?:RecordRow[]}&RecordRow
  const rows=data.items??(data.id?[data]:[])
  const ids=rows.map(row=>row.id)
  const {bindings,configuration}=requestContext(),runtime=createPennyRuntime(bindings,configuration)
  // Snapshot business reads retain the same transaction-time session guard as
  // their individual API endpoints. Public loaders never enter this path.
  const tasks:Promise<Resources>[]=[]
  if(path==='/app/feedback'||path==='/app/roadmap'||path==='/app/moderation'||path.startsWith('/app/decisions/')){
    const db=await decisionDatabase(runtime,getRequest())
    if(path==='/app/feedback')tasks.push(fieldSnapshot(db,'evidence',ids),evidenceSnapshot(db,ids))
    if(path==='/app/roadmap')tasks.push(fieldSnapshot(db,'roadmapItem',ids),roadmapContexts(db,ids).then(contexts=>Object.fromEntries(Object.entries(contexts).map(([id,data])=>[`/api/operator/roadmap/${id}/context`,result(data)]))))
    if(path==='/app/moderation'){
      tasks.push(fieldSnapshot(db,'request',ids),requestContexts({binding:db},rows.map(row=>row.slug)).then(contexts=>Object.fromEntries(Object.entries(contexts).map(([slug,data])=>[`/api/operator/requests/${slug}/context`,result(data)]))))
      tasks.push(db.prepare('SELECT request_id AS entityId,id,provider,issue_url,state,source_updated_at FROM penny_tracker_links WHERE request_id IN (SELECT value FROM json_each(?)) ORDER BY created_at,id').bind(JSON.stringify(ids)).all<{entityId:string}>().then(links=>Object.fromEntries(ids.map(id=>[`/api/operator/integrations/trackers/request/${id}`,result({links:links.results.filter(link=>link.entityId===id).map(({entityId:_,...link})=>link)})]))))
    }
    if(path.startsWith('/app/decisions/')){
      tasks.push(fieldSnapshot(db,'decision',ids),read(ids.flatMap(id=>[`/api/operator/decisions/${id}/history`,...(!['draft','ready'].includes(data.state??'')?[`/api/operator/decisions/${id}/post-release`]:[])])))
    }
  }
  return Object.assign(resources,...await Promise.all(tasks))
}
