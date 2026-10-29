import {z} from 'zod'
import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {integrationOperator} from '../integrations/destinations'
import {guardedDatabase} from '../integrations/guarded-database'
import {sessionGuard} from '../integrations/keys'
import {NativeError} from '../auth/native-tokens'
import {parseInput} from '../auth/native-routes'
import {audit} from '../decisions/write-support'
import {connectionInput,connection,publicListing} from './configuration'
import {listingLink} from './review-link'
import {seal} from './secrets'
const path='/api/operator/integrations/reviews'
export function registerReviewRoutes(app:Hono<OperatorMutationEnvironment>){
 app.use(path+'*',async(c,next)=>{c.header('Cache-Control','private, no-store');await next()})
 app.get('/api/operator/evidence/:id/review-proposals',async c=>{
  const {db}=await integrationOperator(c.get('runtime'),c.req.raw);c.header('Cache-Control','private, no-store')
  return c.json((await db.prepare('SELECT p.*,r.slug closest_request_slug FROM penny_review_proposals p LEFT JOIN requests r ON r.id=p.closest_request_id JOIN penny_review_sources s ON s.evidence_id=p.evidence_id JOIN evidence_versions v ON v.id=p.version_id WHERE p.evidence_id=? AND s.source_state IN(\'current\',\'changed\') AND v.version_number=(SELECT MAX(version_number) FROM evidence_versions WHERE evidence_id=p.evidence_id)').bind(c.req.param('id')).all()).results)
 })
 app.get(path,async c=>{
  const runtime=c.get('runtime'),{db,session}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')return c.json({canConfigure:false})
  const connections=(await db.prepare('SELECT c.*,(SELECT display_name FROM operators WHERE id=c.actor_id) ownerName,EXISTS(SELECT 1 FROM penny_review_credentials WHERE connection_id=c.id) hasCredential,(SELECT count(*) FROM penny_review_sources s WHERE s.connection_id=c.id AND s.ai_state IN(\'pending\',\'running\')) backlog FROM penny_review_connections c ORDER BY c.site,c.listing LIMIT 50').all()).results
  return c.json({canConfigure:true,configured:!!runtime.bindings.PENNY_REVIEWS_EGRESS,connections})
 })
 app.post(path,async c=>{
  const runtime=c.get('runtime'),admitted=await integrationOperator(runtime,c.req.raw),{session,actor}=admitted
  if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
  const input=await parseInput(c.req.raw,connectionInput),id=input.site+'/'+input.listing,publicPage=['capterra','trustradius'].includes(input.site)
  if(!runtime.bindings.PENNY_REVIEWS_EGRESS)throw new NativeError('reviews_transport_unconfigured',503)
  if(['g2','producthunt'].includes(input.site)){if(!input.publicUrl)throw new NativeError('reviews_public_listing_required',400);listingLink(input.site,input.publicUrl)}
  if(publicPage){publicListing(input.site,input.publicUrl);if(!input.termsAccepted)throw new NativeError('reviews_terms_required',400)}
  if(input.token&&input.credential||input.credential&&input.credential.kind!=='access_token'&&input.credential.kind!==input.site)throw new NativeError('reviews_credential_kind_invalid',400)
  if(publicPage&&(input.token||input.credential))throw new NativeError('reviews_public_credential_refused',400)
  if(!publicPage&&!input.token&&!input.credential&&!await admitted.db.prepare('SELECT 1 FROM penny_review_credentials WHERE connection_id=?').bind(id).first())throw new NativeError('reviews_credentials_missing',400)
  if(!await connection(admitted.db,id)&&await admitted.db.prepare('SELECT count(*) n FROM penny_review_connections').first<number>('n')===50)throw new NativeError('reviews_connection_limit',409)
  const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')";guard.params.push(session.operatorId)
  const db=guardedDatabase(runtime.database.binding,guard),now=new Date().toISOString(),encrypted=input.token||input.credential?await seal(runtime,id,JSON.stringify({credential:input.credential??{kind:'access_token',value:input.token}})):null
  await db.batch([
   db.prepare(`INSERT INTO penny_review_connections(id,site,listing,public_url,terms_accepted,interval_hours,purge_days,extract,owner_id,owner_version,actor_id,revision,state,next_due,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,1,'scheduled',?,?) ON CONFLICT(id) DO UPDATE SET public_url=excluded.public_url,terms_accepted=excluded.terms_accepted,interval_hours=excluded.interval_hours,purge_days=excluded.purge_days,extract=excluded.extract,owner_id=excluded.owner_id,owner_version=excluded.owner_version,actor_id=excluded.actor_id,revision=penny_review_connections.revision+1,state='scheduled',claim=NULL,cursor=NULL,failure=NULL,next_due=excluded.next_due,updated_at=excluded.updated_at`).bind(id,input.site,input.listing,publicPage?publicListing(input.site,input.publicUrl):input.publicUrl?listingLink(input.site,input.publicUrl):null,input.termsAccepted?1:0,input.intervalHours,input.purgeDays,input.extract?1:0,session.operatorId,session.operator.version,actor.id,now,now),
   ...(encrypted?[db.prepare('INSERT INTO penny_review_credentials(connection_id,encrypted_token) VALUES(?,?) ON CONFLICT(connection_id) DO UPDATE SET encrypted_token=excluded.encrypted_token,refresh_claim=NULL').bind(id,encrypted)]:[]),
   db.prepare("UPDATE penny_review_sources SET ai_state=CASE WHEN ai_state='running' THEN 'failed' ELSE ai_state END,ai_failure=CASE WHEN ai_state='running' THEN 'reviews_configuration_changed_reconcile_before_retry' ELSE ai_failure END,ai_claim=NULL,check_claim=NULL,check_failure=NULL,next_check=? WHERE connection_id=?").bind(new Date(Date.now()+86400000).toISOString(),id),
   audit(db,actor.id,'integration',id,'reviews.connected',now),
  ])
  return c.json({saved:true,id},201)
 })
 app.post(path+'/actions',async c=>{
  const runtime=c.get('runtime'),{session,actor}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
  const input=await parseInput(c.req.raw,z.object({id:z.string().max(200),action:z.enum(['pause','resume','retry','disconnect','retry-extraction']),acknowledgePaidRetry:z.boolean().optional()}).strict()),current=await connection(runtime.database.binding,input.id)
  if(!current)throw new NativeError('reviews_connection_missing',404)
  if(['resume','retry','retry-extraction'].includes(input.action)&&['disconnected','held'].includes(current.state))throw new NativeError('reviews_reconnect_required',409)
  if(input.action==='retry-extraction'&&!input.acknowledgePaidRetry)throw new NativeError('reviews_paid_retry_acknowledgment_required',409)
  const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')";guard.params.push(session.operatorId)
  const db=guardedDatabase(runtime.database.binding,guard),now=new Date().toISOString()
  if(input.action==='retry-extraction'){
   if(current.state!=='scheduled')throw new NativeError('reviews_resume_required',409)
   await db.batch([db.prepare("UPDATE penny_review_sources SET ai_state='pending',ai_failure=NULL,ai_claim=NULL WHERE connection_id=? AND ai_state='failed' AND source_state='current'").bind(input.id),audit(db,actor.id,'integration',input.id,'reviews.extraction_retry_acknowledged',now)])
  }else{
   const stopping=['pause','disconnect'].includes(input.action)
   await db.batch([
    db.prepare('UPDATE penny_review_connections SET state=?,claim=NULL,revision=revision+1,owner_id=?,owner_version=?,actor_id=?,failure=NULL,next_due=?,updated_at=? WHERE id=?').bind(input.action==='disconnect'?'disconnected':stopping?'paused':'scheduled',session.operatorId,session.operator.version,actor.id,now,now,input.id),
    ...(input.action==='disconnect'?[db.prepare('DELETE FROM penny_review_credentials WHERE connection_id=?').bind(input.id)]:[]),
    db.prepare("UPDATE penny_review_sources SET ai_state=CASE WHEN ai_state='running' THEN 'failed' ELSE ai_state END,ai_failure=CASE WHEN ai_state='running' THEN 'reviews_stopped_reconcile_before_retry' ELSE ai_failure END,ai_claim=NULL,check_claim=NULL,check_failure=NULL WHERE connection_id=?").bind(input.id),
    audit(db,actor.id,'integration',input.id,'reviews.'+input.action,now),
   ])
  }
  return c.json({saved:true})
 })
}
