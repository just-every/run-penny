import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import type {PennyRuntime} from '@/core/app/runtime'
import {integrationOperator} from '../integrations/destinations'
import {guardedDatabase} from '../integrations/guarded-database'
import {sessionGuard} from '../integrations/keys'
import {NativeError} from '../auth/native-tokens'
import {csvExport} from './csv'
export async function ownerCsv(runtime:PennyRuntime,request:Request,kind:'requests'|'voters'){
 const {actor,session}=await integrationOperator(runtime,request)
 if(session.kind!=='native'||session.operator.role!=='owner')throw new NativeError('native_owner_session_required',403)
 const params=new URL(request.url).searchParams
 if(params.size)throw new NativeError('csv_filter_invalid',400)
 const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')";guard.params.push(session.operatorId)
 const db=guardedDatabase(runtime.database.binding,guard)
 return csvExport(db,kind,{id:actor.id})
}
export function registerCsvRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/data/csv-capability',async c=>{const {session}=await integrationOperator(c.get('runtime'),c.req.raw);c.header('Cache-Control','private, no-store');return c.json({canExport:session.kind==='native'&&session.operator.role==='owner'})})
 app.get('/api/operator/data/requests.csv',c=>ownerCsv(c.get('runtime'),c.req.raw,'requests'))
 app.get('/api/operator/data/voters.csv',c=>ownerCsv(c.get('runtime'),c.req.raw,'voters'))
}
