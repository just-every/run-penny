import {z} from 'zod'
import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {integrationOperator} from '../integrations/destinations'
import {guardedDatabase} from '../integrations/guarded-database'
import {sessionGuard} from '../integrations/keys'
import {authMail,providerMail} from '../auth/mail'
import {NativeError,digest} from '../auth/native-tokens'
import {parseInput} from '../auth/native-routes'
import {createUlid} from '@/core/shared/ulid'
import {businessInput,identityHeaders,mailIdentity,mailIdentityInput} from './mail-identity'
async function owner(runtime:Parameters<typeof integrationOperator>[0],request:Request){
 const {session,actor}=await integrationOperator(runtime,request)
 if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
 const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')";guard.params.push(session.operatorId)
 return {session,actor,db:guardedDatabase(runtime.database.binding,guard)}
}
const audit=(db:D1Database,actor:string,action:string,now:string)=>db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,?,'settings','mail-identity',?,?,?)`).bind(createUlid(),actor,action,now,now,now)
export function registerMailIdentityRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/settings/mail',async c=>{
  const runtime=c.get('runtime'),{session}=await integrationOperator(runtime,c.req.raw),identity=await mailIdentity(runtime)
  const provider=runtime.configuration.mailProvider
  return c.json({identity:identity?{...identity,fromAddress:identity.fromAddress??runtime.configuration.mailFrom?.match(/<([^<>]+)>$/u)?.[1]??runtime.configuration.mailFrom??''}:{companyName:'',senderName:'',fromAddress:runtime.configuration.mailFrom?.match(/<([^<>]+)>$/u)?.[1]??runtime.configuration.mailFrom??'',replyTo:null,postalAddress:''},owner:session.operator.role==='owner',providerTestAvailable:Boolean(authMail(runtime)&&['sendgrid','resend'].includes(provider??'')&&!runtime.configuration.demo&&runtime.configuration.environment!=='local'),postalAddressRequired:!identity?.postalAddress})
 })
 // Recording the postal address remains possible while delivery is unconfigured.
 app.put('/api/operator/settings/business',async c=>{
  const runtime=c.get('runtime'),input=await parseInput(c.req.raw,businessInput.extend({confirmPostalAddress:z.literal(true)})),{db,actor}=await owner(runtime,c.req.raw),now=new Date().toISOString()
  await db.batch([db.prepare(`INSERT INTO penny_mail_identity(singleton,company_name,postal_address,updated_at) VALUES(1,?,?,?) ON CONFLICT(singleton) DO UPDATE SET company_name=excluded.company_name,postal_address=excluded.postal_address,updated_at=excluded.updated_at`).bind(input.companyName,input.postalAddress,now),audit(db,actor.id,'business.postal_address_confirmed',now)])
  return c.json({saved:true})
 })
 app.post('/api/operator/settings/mail/test',async c=>{
  const runtime=c.get('runtime'),input=await parseInput(c.req.raw,mailIdentityInput),{db,session,actor}=await owner(runtime,c.req.raw),sender=providerMail(runtime),provider=runtime.configuration.mailProvider
  // Relay v1 cannot represent reply-to; it cannot verify an arbitrary sender domain.
  if(!sender||!['sendgrid','resend'].includes(provider??'')||runtime.configuration.demo||runtime.configuration.environment==='local')throw new NativeError('provider_sender_test_unavailable',409,'Configure SendGrid or Resend to test a sender address before saving it.')
  const id=createUlid(),hash=await digest(JSON.stringify({input,provider,key:runtime.configuration.mailApiKey})),now=Date.now()
  await db.prepare('INSERT INTO penny_mail_identity_tests(id,operator_id,operator_version,input_hash,provider,outcome,tested_at) VALUES(?,?,?,?,?,\'unknown\',?)').bind(id,session.operatorId,session.operator.version,hash,provider!,now).run()
  let result:{status:string;code?:string}={status:'uncertain'}
  try{result=await sender.send({deliveryId:id,...identityHeaders(input,input.fromAddress),to:[session.operator.email],subject:'Confirm your Penny sender identity',text:`This is a sender identity test for ${input.companyName}.\n\nConfirm receipt in settings before saving.\n\n${input.postalAddress}`,headers:{'Auto-Submitted':'auto-generated'}})}catch{result={status:'uncertain'}}
  await db.batch([db.prepare('UPDATE penny_mail_identity_tests SET outcome=? WHERE id=?').bind(result.status,id),audit(db,actor.id,'mail.sender_tested',new Date().toISOString())])
  return c.json({testId:id,provider,result:result.status,accepted:result.status==='accepted',message:result.status==='accepted'?'Provider accepted the test. Confirm you received it before saving.':'Provider did not accept the sender. Settings have not been saved.'})
 })
 app.put('/api/operator/settings/mail',async c=>{
  const runtime=c.get('runtime'),body=await parseInput(c.req.raw,mailIdentityInput.extend({testId:z.string().min(1).max(128),acceptProviderResult:z.literal(true)})),{db,session,actor}=await owner(runtime,c.req.raw)
  if(await runtime.database.binding.prepare('SELECT 1 FROM penny_email_capture_settings WHERE capture_address IN(?,?)').bind(body.fromAddress,body.replyTo).first())throw new NativeError('capture_sender_collision',409,'The sender and reply-to must differ from the capture address.')
  const {testId,acceptProviderResult:_,...input}=body,hash=await digest(JSON.stringify({input,provider:runtime.configuration.mailProvider,key:runtime.configuration.mailApiKey})),guard=createUlid(),now=new Date().toISOString()
  // A receipt belongs to this exact configuration and native operator version; a
  // changed setting or concurrent save cannot reuse it, and rejection never saves.
  try{await db.batch([
   db.prepare(`INSERT INTO requester_write_guards(id,permitted) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM penny_mail_identity_tests WHERE id=? AND operator_id=? AND operator_version=? AND input_hash=? AND outcome='accepted' AND tested_at>? AND consumed_at IS NULL) AND NOT EXISTS(SELECT 1 FROM penny_email_capture_settings WHERE capture_address IN(?,?)) THEN 1 ELSE 0 END)`).bind(guard,testId,session.operatorId,session.operator.version,hash,Date.now()-1800000,input.fromAddress,input.replyTo),
   db.prepare(`INSERT INTO penny_mail_identity(singleton,company_name,sender_name,from_address,reply_to,postal_address,updated_at) VALUES(1,?,?,?,?,?,?) ON CONFLICT(singleton) DO UPDATE SET company_name=excluded.company_name,sender_name=excluded.sender_name,from_address=excluded.from_address,reply_to=excluded.reply_to,postal_address=excluded.postal_address,updated_at=excluded.updated_at`).bind(input.companyName,input.senderName,input.fromAddress,input.replyTo,input.postalAddress,now),
   db.prepare('UPDATE penny_mail_identity_tests SET consumed_at=? WHERE id=?').bind(Date.now(),testId),audit(db,actor.id,'mail.identity_saved',now),db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(guard),
  ])}catch(error){if(String(error).includes('requester_write_admitted'))throw new NativeError('accepted_sender_test_required',409);throw error}
  return c.json({saved:true})
 })
}
