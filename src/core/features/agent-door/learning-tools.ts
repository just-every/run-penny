import type {PennyRuntime} from '@/core/app/runtime'
import {tool,external} from './tool'
import {draftNative,draftInput} from '../ai/drafts'

export function learningTools(runtime:PennyRuntime){return [
 tool(runtime,{name:'drafts.create',title:'Prepare a cited native summary or reply through the configured model',scope:'learning:write',clauses:['AI-006'],classes:['external'],schema:draftInput,classify:async()=>external('known',1),summary:async(a)=>({target:{id:a.id},items:[a.kind,'Only role-permitted source context goes to the configured model.']}),run:(a,n)=>draftNative(runtime,n.db,a)})
]}
