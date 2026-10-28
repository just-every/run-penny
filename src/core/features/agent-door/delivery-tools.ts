import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {tool,id,external} from './tool'
import {dispatchNotification} from '../notifications/delivery'
import {dispatchReleaseDelivery} from '../releases/delivery'
import {notificationContent} from '../notifications/content'
import {releaseContent} from '../releases/delivery-admission'
import {sameDeliveryOrigin} from './deferred'
export function deliveryTools(runtime:PennyRuntime){return [
 tool(runtime,{name:'deliveries.dispatch',title:'Dispatch one retained native customer delivery under current consent and policy',scope:'delivery:write',clauses:['NOTIFY-001','NOTIFY-002','NOTIFY-009','REL-004','REL-007','SURFACE-003'],classes:['external'],schema:z.object({kind:z.enum(['request','release']),id}),
 classify:async(a,_n,c)=>{await sameDeliveryOrigin(runtime,a.kind,a.id,c);return external('known',1)},
 summary:async(a,n)=>{const rows=a.kind==='request'?[await notificationContent(n.db,a.id)]:await releaseContent(n.db,a.id);return {target:{id:a.id},recipients:rows.filter(Boolean).map(r=>r!.email),items:rows.filter(Boolean).map(r=>'title' in r!?String(r.title):a.kind)}},
 run:async(a,n,c)=>{await sameDeliveryOrigin(runtime,a.kind,a.id,c);const current={...runtime,database:n.database};if(a.kind==='request')await dispatchNotification(current,a.id);else await dispatchReleaseDelivery(current,a.id);return {id:a.id,state:await n.db.prepare(a.kind==='request'?'SELECT state FROM notification_batches WHERE id=?':'SELECT delivery_state AS state FROM notification_outbox WHERE id=?').bind(a.id).first<string>('state')}}}),
]}
