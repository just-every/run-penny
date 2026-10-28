import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {tool,id,name} from './tool'
import {RequestOperatorRepository} from '../requests/operator-repository'
import {workspaceClockInput,saveWorkspaceClock} from '../settings/workspace-clock'
import {audit} from '../decisions/write-support'

export function settingsTools(runtime:PennyRuntime){return [
 tool(runtime,{name:'settings.board',title:'Update native board and participation settings',scope:'settings:write',clauses:['REQ-019','REQ-033','REQ-040'],classes:['live'],schema:z.object({slug:id,name:name.optional(),visibility:z.enum(['public','internal']).optional(),categoryMode:z.enum(['off','optional','required']).optional(),postingPolicy:z.enum(['requesters','operators']).optional(),commentsAllowed:z.boolean().optional(),showVoteCounts:z.boolean().optional(),showVoters:z.boolean().optional(),anonymousRequesters:z.boolean().optional(),archived:z.boolean().optional()}),classify:async()=>[{class:'live',facts:{measure:1,service:'portal_and_widget'}}],run:async(a,n)=>{await new RequestOperatorRepository(n.database).updateBoard({...a,operatorId:n.actor,now:n.now});return {ok:true}}}),
 tool(runtime,{name:'settings.clock',title:'Save native workspace time and requester quiet hours',scope:'settings:write',clauses:['OPS-008','NOTIFY-008'],classes:['live'],schema:workspaceClockInput,classify:async()=>[{class:'live',facts:{measure:1,service:'requester_mail_schedule'}}],run:async(a,n)=>{await n.db.batch([saveWorkspaceClock(n.db,a,n.now),audit(n.db,n.actor,'settings','clock','settings.clock_changed',n.now)]);return {saved:true}}}),
]}
