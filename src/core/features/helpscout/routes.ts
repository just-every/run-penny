import type {Hono} from 'hono'
import {z} from 'zod'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {NativeError,digest} from '../auth/native-tokens'
import {parseInput} from '../auth/native-routes'
import {signedBody} from './signatures'
import {activeConnection,connectionDb,sourceId,type Secrets} from './configuration'
import {registerHelpScoutSettings} from './settings'
import {actionInput,sidebarAction} from './actions'
import {enqueue} from './work'
import panel from './panel.html?raw'
import script from './panel.js?raw'
import style from './panel.css?raw'
const path='/api/integrations/helpscout'
export function registerHelpScoutRoutes(app:Hono<OperatorMutationEnvironment>){
 registerHelpScoutSettings(app)
 app.use(path+'*',async(c,next)=>{c.header('Cache-Control','private, no-store');c.header('Referrer-Policy','no-referrer');await next()})
 app.get(path+'/panel',c=>c.html(panel))
 app.get(path+'/panel.js',c=>c.body(script,200,{'Content-Type':'text/javascript; charset=utf-8'}))
 app.get(path+'/panel.css',c=>c.body(style,200,{'Content-Type':'text/css; charset=utf-8'}))
 app.post(path+'/sidebar',async c=>{
  const runtime=c.get('runtime'),connection=await activeConnection(runtime),db=connectionDb(runtime,connection),secrets=await db.prepare('SELECT * FROM penny_helpscout_secrets WHERE connection_id=?').bind(connection.id).first<Secrets>()
  const value=await signedBody(c.req.raw,secrets!.app_secret)
  const input=z.object({ticket:z.object({id:sourceId}),mailbox:z.object({id:sourceId}),user:z.object({id:sourceId})}).safeParse(value)
  if(!input.success)throw new NativeError('helpscout_payload_invalid',400)
  if(input.data.mailbox.id!==connection.mailbox_id||input.data.user.id!==connection.sidebar_user_id)throw new NativeError('helpscout_sidebar_scope_refused',403)
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('')
  await db.batch([db.prepare('DELETE FROM penny_helpscout_contexts WHERE expires_at<=?').bind(Date.now()),db.prepare('INSERT INTO penny_helpscout_contexts(token_hash,connection_id,conversation_id,user_id,revision,expires_at) VALUES(?,?,?,?,?,?)').bind(await digest(token),connection.id,input.data.ticket.id,input.data.user.id,connection.revision,Date.now()+600000)])
  // The delegated, short-lived token has this conversation only. Provider
  // secrets and broad Penny session/API credentials never reach the iframe.
  const src=runtime.configuration.appOrigin+path+'/panel#context='+token
  return c.json({html:`<iframe title="Penny feedback" src="${src.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" style="width:100%;height:900px;border:0" referrerpolicy="no-referrer"></iframe>`})
 })
 app.post(path+'/webhook',async c=>{
  const runtime=c.get('runtime'),connection=await activeConnection(runtime),db=connectionDb(runtime,connection),secrets=await db.prepare('SELECT * FROM penny_helpscout_secrets WHERE connection_id=?').bind(connection.id).first<Secrets>()
  const value=await signedBody(c.req.raw,secrets!.webhook_secret),input=z.object({id:sourceId,mailboxId:sourceId,tags:z.array(z.object({tag:z.string().max(100)})).max(100)}).safeParse(value)
  if(!input.success)throw new NativeError('helpscout_payload_invalid',400)
  // Scope is decided from signed metadata before any provider call. Other
  // event contents are ignored, including customer wording and attachments.
  if(input.data.mailboxId===connection.mailbox_id&&input.data.tags.some(t=>t.tag===connection.tag))await enqueue(runtime,connection,input.data.id)
  return c.json({accepted:true},202)
 })
 app.post(path+'/action',async c=>{
  const token=/^Bearer ([a-f0-9]{64})$/.exec(c.req.header('Authorization')??'')?.[1]
  if(!token)throw new NativeError('helpscout_context_required',401)
  const parsed=actionInput.safeParse(await parseInput(c.req.raw,z.unknown()))
  if(!parsed.success)throw new NativeError('validation_failed',400)
  return c.json(await sidebarAction(c.get('runtime'),token,parsed.data))
 })
}
