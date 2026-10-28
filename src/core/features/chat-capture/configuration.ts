import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
import {integrationOperator} from '../integrations/destinations'
import {guardedDatabase} from '../integrations/guarded-database'
import {readDatabase} from '../integrations/read-database'
import {sessionGuard,sessionReadGuard} from '../integrations/keys'
import {audit} from '../decisions/write-support'
import {slack} from './slack'

const identity=z.string().regex(/^[A-Z][A-Z0-9]{1,79}$/)
export const connectionInput=z.object({
 teamId:identity,appId:identity,channels:z.array(identity).min(1).max(50),
 workspaceAccounts:z.array(z.object({teamId:identity,accountId:z.string().min(1).max(128)}).strict()).max(50),
 reaction:z.string().regex(/^[a-z0-9_+-]{1,64}$/),purgeDays:z.number().int().min(0).max(365).default(30),
 botToken:z.string().min(10).max(4096).regex(/^[^\s\0]+$/),signingSecret:z.string().min(16).max(4096).regex(/^[^\s\0]+$/),
}).strict()
export interface ChatConnection {
 id:string;team_id:string;app_id:string;channels_json:string;mappings_json:string;reaction:string;purge_days:number;
 native_operator_id:string;operator_version:number;actor_id:string;state:string;bot_token:string;signing_secret:string
}
export const channels=(connection:ChatConnection):string[]=>JSON.parse(connection.channels_json)
export async function ownerConfiguration(runtime:PennyRuntime,request:Request){
 const access=await integrationOperator(runtime,request)
 if(access.session.operator.role!=='owner')throw new NativeError('owner_required',403)
 const guard=request.method==='GET'?sessionReadGuard(access.session):sessionGuard(access.session)
 guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')"
 guard.params.push(access.session.operatorId)
 return {...access,db:request.method==='GET'?readDatabase(runtime.database.binding,guard):guardedDatabase(runtime.database.binding,guard)}
}
export async function connect(runtime:PennyRuntime,request:Request,input:z.infer<typeof connectionInput>){
 const {session,actor,db}=await ownerConfiguration(runtime,request)
 if(!runtime.bindings.PENNY_EGRESS)throw new NativeError('integration_relay_required',409)
 const identity=await slack(runtime,{bot_token:input.botToken},'auth.test',{})
 if(identity.team_id!==input.teamId)throw new NativeError('slack_token_workspace_mismatch',422)
 if(new Set(input.channels).size!==input.channels.length||new Set(input.workspaceAccounts.map(row=>row.teamId)).size!==input.workspaceAccounts.length)throw new NativeError('duplicate_capture_scope',422)
 for(const mapping of input.workspaceAccounts)if(!await db.prepare('SELECT id FROM accounts WHERE id=?').bind(mapping.accountId).first())throw new NativeError('account_not_found',422)
 const id=crypto.randomUUID(),now=Date.now()
 await db.batch([
  db.prepare('INSERT INTO penny_chat_connections(id,team_id,app_id,channels_json,mappings_json,reaction,purge_days,native_operator_id,operator_version,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,input.teamId,input.appId,JSON.stringify(input.channels),JSON.stringify(input.workspaceAccounts),input.reaction,input.purgeDays,session.operatorId,session.operator.version,actor.id,now),
  db.prepare('INSERT INTO penny_chat_secrets(connection_id,bot_token,signing_secret) VALUES(?,?,?)').bind(id,input.botToken,input.signingSecret),
  audit(db,actor.id,'settings',id,'slack.capture_connected',new Date(now).toISOString()),
 ])
 return {id,eventsPath:'/api/integrations/chat/'+id+'/events',interactivityPath:'/api/integrations/chat/'+id+'/interactivity'}
}
export async function connection(runtime:PennyRuntime,id:string){
 return runtime.database.binding.prepare(`SELECT c.*,s.bot_token,s.signing_secret FROM penny_chat_connections c
 JOIN penny_chat_secrets s ON s.connection_id=c.id JOIN oa_operators o ON o.id=c.native_operator_id
 WHERE c.id=? AND c.state='active' AND o.status='active' AND o.role='owner' AND o.version=c.operator_version`).bind(id).first<ChatConnection>()
}
