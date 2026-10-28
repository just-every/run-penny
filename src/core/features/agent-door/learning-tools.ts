import {learningCustody} from './learning-custody'
import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {tool,id,external} from './tool'
import {draftNative,draftInput} from '../ai/drafts'
import {investigationInput} from '../learning/schema'
import {createNativeInvestigation} from '../learning/service'
import {runInvestigation} from '../learning/run'
import {context} from '../learning/authority'
import {revokeInvestigation} from '../learning/revoke'
import {learningAudit} from '../learning/audit'
import {ToolRefusal} from '../../../../base/modules/agent-door/errors.ts'

export function learningTools(runtime:PennyRuntime){return [
 tool(runtime,{name:'drafts.create',title:'Prepare a cited native summary or reply through the configured model',scope:'learning:write',clauses:['AI-006'],classes:['external'],schema:draftInput,classify:async()=>external('known',1),summary:async(a)=>({target:{id:a.id},items:[a.kind,'Only role-permitted source context goes to the configured model.']}),run:(a,n)=>draftNative(runtime,n.db,a)}),
 tool(runtime,{name:'learning.prepare',title:'Create a bounded native investigation over selected evidence',scope:'learning:write',clauses:['LEARN-001','LEARN-002','AGENT-001','AGENT-002'],schema:investigationInput,run:async(a,n,c)=>{const row=await n.db.prepare('SELECT version FROM oa_operators WHERE id=?').bind(c.person.id).first<{version:number}>();if(!row)throw new ToolRefusal('sponsor_inactive');return createNativeInvestigation({db:n.db,nativeId:c.person.id,version:row.version,actorId:n.actor},a)}}),
 tool(runtime,{name:'learning.execute',title:'Run one native investigation through the enforcing source and model ports',scope:'learning:write',clauses:['LEARN-001','LEARN-002','LEARN-004','AGENT-004','AGENT-006','AGENT-007','AGENT-008','AGENT-009'],classes:['external'],schema:z.object({id,eventKey:id}),revision:async(a,n)=>String((await context(n.db,a.id)).i.version),summary:async(a,n,c)=>{const {i,s}=await learningCustody(n.db,a.id,c);return {target:{id:i.id,name:i.question||i.purpose},items:[i.purpose,s.provider,s.resource_ids_json,i.native_evidence_ids_json,i.native_request_ids_json,'Expires '+i.expires_at,'Native run ceiling '+i.max_run_cost_micros+' micros']}},classify:async(a,n,c)=>{const {s}=await learningCustody(n.db,a.id,c);return external('known',s.provider==='orbit'?JSON.parse(s.resource_ids_json).length+1:1)},run:async(a,n,c)=>{await learningCustody(n.db,a.id,c);return runInvestigation({...runtime,database:n.database},a.id,a.eventKey,{db:n.db,actor:{operatorId:n.actor}})}}),
 tool(runtime,{name:'learning.control',title:'Pause, resume or revoke a native investigation',scope:'learning:write',clauses:['LEARN-004','AGENT-004'],schema:z.object({id,action:z.enum(['pause','resume','revoke'])}),run:async(a,n,c)=>{
  const {i,s}=await context(n.db,a.id)
  if(a.action==='revoke'){await revokeInvestigation(n.db,i,n.actor);return {ok:true}}
  if(i.state==='revoked'||i.state==='held')throw new ToolRefusal('learning_control_requires_new_grant')
  if(a.action==='resume'&&(s.state!=='active'||i.expires_at<=n.now||i.spent_micros+i.max_run_cost_micros>i.budget_micros))throw new ToolRefusal('learning_resume_requires_new_grant')
  const person=await n.db.prepare('SELECT version FROM oa_operators WHERE id=?').bind(c.person.id).first<{version:number}>()
  await n.db.batch([n.db.prepare("UPDATE learning_investigations SET state=?,version=version+1,native_operator_id=?,operator_version=?,actor_id=?,last_reason=?,next_run_at=? WHERE id=? AND version=?").bind(a.action==='pause'?'paused':'active',c.person.id,person!.version,n.actor,'agent_'+a.action,n.now,i.id,i.version),n.db.prepare("UPDATE learning_runs SET state='uncertain',reason='operator_control' WHERE investigation_id=? AND state='running'").bind(i.id),learningAudit(n.db,{operatorId:n.actor},'learning_investigation',i.id,a.action==='pause'?'learning.paused':'learning.resumed',{grantVersion:i.version+1})])
  return {ok:true}
 }}),
]}
