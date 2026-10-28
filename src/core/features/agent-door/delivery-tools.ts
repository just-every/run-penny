import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {tool,id,external} from './tool'
import {dispatchRejection} from '../notifications/rejection-delivery'
import {rejectionContext} from '../notifications/rejection-admission'
import {dispatchNotification} from '../notifications/delivery'
import {dispatchReleaseDelivery} from '../releases/delivery'
import {notificationContent} from '../notifications/content'
import {releaseContent} from '../releases/delivery-admission'
import {sameDeliveryOrigin} from './deferred'
import {prepareBatches} from '../notifications/batches'
export function deliveryTools(runtime:PennyRuntime){return [
 tool(runtime,{name:'deliveries.prepare',title:'Coalesce native pending mail and inspect retained delivery work',scope:'delivery:write',clauses:['NOTIFY-001','NOTIFY-002'],schema:z.object({slug:id}),run:async(a,n,c)=>{await prepareBatches(n.db,n.now);const rows=(await n.db.prepare("SELECT b.id,b.next_attempt_at AS availableAt,b.state FROM notification_batches b JOIN requests r ON r.id=b.request_id WHERE r.slug=? AND b.state='queued' ORDER BY b.created_at DESC,b.id").bind(a.slug).all<{id:string;availableAt:string;state:string}>()).results;const items=[];for(const row of rows){try{await sameDeliveryOrigin(runtime,'request',row.id,c);items.push(row)}catch{}}return {items}}}),
 tool(runtime,{name:'deliveries.dispatch',title:'Dispatch one retained native customer delivery under current consent and policy',scope:'delivery:write',clauses:['NOTIFY-001','NOTIFY-002','NOTIFY-009','REL-004','REL-007','SURFACE-003'],classes:['external'],schema:z.object({kind:z.enum(['request','release','rejection']),id}),
 classify:async(a,_n,c)=>{await sameDeliveryOrigin(runtime,a.kind,a.id,c);return external('known',1)},
 summary:async(a,n)=>{const rows=a.kind==='request'?[await notificationContent(n.db,a.id)]:a.kind==='rejection'?[await rejectionContext(n.db,a.id)]:await releaseContent(n.db,a.id);return {target:{id:a.id},recipients:rows.filter(Boolean).flatMap(r=>r!.email?[r!.email]:[]),items:rows.filter(Boolean).map(r=>'title' in r!?String(r.title):a.kind)}},
 run:async(a,n,c)=>{await sameDeliveryOrigin(runtime,a.kind,a.id,c);const current={...runtime,database:n.database};if(a.kind==='request')await dispatchNotification(current,a.id);else if(a.kind==='rejection')await dispatchRejection(current,a.id);else await dispatchReleaseDelivery(current,a.id);return {id:a.id,state:await n.db.prepare(a.kind==='request'?'SELECT state FROM notification_batches WHERE id=?':'SELECT delivery_state AS state FROM notification_outbox WHERE id=?').bind(a.id).first<string>('state')}}}),
]}
