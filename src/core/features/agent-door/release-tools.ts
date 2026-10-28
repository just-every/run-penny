import { z } from 'zod'
import type { PennyRuntime } from '@/core/app/runtime'
import {tool,id,revision,external} from './tool'
import {releaseDraftSchema,saveReleaseDraft} from '../releases/drafts'
import {publishRelease} from '../releases/publication'
import {workspaceReadService} from '../workspace/service'
import {portalReadService} from '../portal/service'
import {proxyContacts} from '../requests/proxy-votes'
import {publicRequestFiltersSchema} from '../portal/routes'
import {ToolRefusal} from '../../../../base/modules/agent-door/errors.ts'

export function releaseTools(runtime:PennyRuntime){return [
 tool(runtime,{name:'releases.draft',title:'Save an exact native release draft',scope:'releases:write',clauses:['REL-001','REL-015','REL-017'],schema:z.object({slug:id.optional(),draft:releaseDraftSchema.omit({authorOperatorId:true})}),revision:async(a,n)=>a.slug?revision(n.db,'releases',a.slug,'slug'):null,run:(a,n)=>saveReleaseDraft(n.db,{...a.draft,authorOperatorId:n.actor},a.slug,n.now,n.actor)}),
 tool(runtime,{name:'releases.publish',title:'Seal and publish the native release and recipient snapshot',scope:'releases:write',clauses:['REL-002','REL-003','REL-016','REL-018','REL-019','WIDGET-003'],classes:['external'],schema:z.object({slug:id}),revision:(a,n)=>revision(n.db,'releases',a.slug,'slug'),classify:async()=>external(),summary:async(a,n)=>{const r=await n.db.prepare('SELECT v.title,v.body FROM releases r JOIN release_versions v ON v.id=r.current_version_id WHERE r.slug=?').bind(a.slug).first<{title:string;body:string}>();return {target:{id:a.slug,name:r?.title},items:[r?.body??'']}},run:(a,n)=>publishRelease(n.db,a.slug,n.now,n.actor)}),
 tool(runtime,{name:'outcomes.get',title:'Read native release outcomes and delivery truth',scope:'feedback:read',readOnly:true,clauses:['REL-009'],schema:z.object({slug:id}),run:async(a,n)=>{const r=await workspaceReadService(n.database).findRelease(a.slug);if(!r)throw new ToolRefusal('not_found');return r}}),
 tool(runtime,{name:'releases.public',title:'Read published releases with the retained API scope',scope:'releases:public',readOnly:true,clauses:['API-001','REL-001'],schema:z.object({slug:id.optional()}),run:async(a,n)=>{if(!a.slug)return {items:await portalReadService(n.database).listReleases()};const r=await portalReadService(n.database).getRelease(a.slug);if(!r)throw new ToolRefusal('not_found');return r}}),
 tool(runtime,{name:'requests.public',title:'Read published requests with the retained API scope',scope:'requests:public',readOnly:true,clauses:['API-001','REQ-026'],schema:z.object({slug:id.optional(),filters:publicRequestFiltersSchema.optional()}),run:async(a,n)=>{if(!a.slug)return {items:await portalReadService(n.database).listRequests(a.filters??{})};const r=await portalReadService(n.database).getRequest(a.slug);if(r.kind!=='found')throw new ToolRefusal('not_found');return r}}),
 tool(runtime,{name:'boards.public',title:'Read public boards with the retained API scope',scope:'requests:public',readOnly:true,clauses:['API-001','REQ-026'],schema:z.object({}),run:async(_a,n)=>({items:await portalReadService(n.database).listBoards()})}),
 tool(runtime,{name:'comments.public',title:'Read published comments with the retained API scope',scope:'comments:public',readOnly:true,clauses:['API-001','REQ-007'],schema:z.object({slug:id}),run:async(a,n)=>{const r=await portalReadService(n.database).getRequest(a.slug);if(r.kind!=='found')throw new ToolRefusal('not_found');return {items:r.request.comments}}}),
 tool(runtime,{name:'status.public',title:'Read public status updates with the retained API scope',scope:'status:public',readOnly:true,clauses:['API-001','REQ-015'],schema:z.object({slug:id}),run:async(a,n)=>{const r=await portalReadService(n.database).getRequest(a.slug);if(r.kind!=='found')throw new ToolRefusal('not_found');return {items:r.request.statusUpdates}}}),
 tool(runtime,{name:'votes.contacts',title:'Search customers for a sourced proxy vote',scope:'votes:write',readOnly:true,clauses:['CAP-014'],schema:z.object({q:z.string().max(200).default('')}),run:async(a,n)=>({items:await proxyContacts(n.db,a.q)})}),
]}
