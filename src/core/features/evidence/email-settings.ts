import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {integrationOperator} from '../integrations/destinations'
import {guardedDatabase} from '../integrations/guarded-database'
import {sessionGuard} from '../integrations/keys'
import {NativeError} from '../auth/native-tokens'
import {parseInput} from '../auth/native-routes'
import {audit} from '../decisions/write-support'
import {captureInput,captureSettings,ownMailboxes} from './email-admission'
export function registerEmailCaptureSettings(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/settings/email-capture',async c=>{
  const runtime=c.get('runtime'),{session}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
  return c.json(await captureSettings(runtime))
 })
 app.put('/api/operator/settings/email-capture',async c=>{
  const runtime=c.get('runtime'),{session,actor}=await integrationOperator(runtime,c.req.raw)
  if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
  const input=await parseInput(c.req.raw,captureInput)
  if((await ownMailboxes(runtime)).includes(input.captureAddress))throw new NativeError('capture_sender_collision',409,'The capture address must differ from every Penny sender and reply-to address.')
  const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner') AND NOT EXISTS(SELECT 1 FROM penny_mail_identity WHERE from_address=? OR reply_to=?)";guard.params.push(session.operatorId,input.captureAddress,input.captureAddress)
  const db=guardedDatabase(runtime.database.binding,guard),now=new Date().toISOString()
  await db.batch([
   db.prepare('INSERT INTO penny_email_capture_settings(singleton,capture_address,updated_at) VALUES(1,?,?) ON CONFLICT(singleton) DO UPDATE SET capture_address=excluded.capture_address,updated_at=excluded.updated_at').bind(input.captureAddress,now),
   db.prepare('DELETE FROM penny_email_capture_domains'),
   ...[...new Set(input.domains)].map(domain=>db.prepare('INSERT INTO penny_email_capture_domains(domain) VALUES(?)').bind(domain)),
   audit(db,actor.id,'settings','email-capture','email.capture_configured',now),
  ])
  return c.json({saved:true})
 })
}
