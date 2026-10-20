import {NativeError} from '../auth/native-tokens'
import type {Capability} from './configuration'
export interface Reservation {id:string;upper:number;extraMicros:number}
export async function reserve(db:D1Database,capability:Capability,provider:string,model:string,upper:number,extraMicros=0):Promise<Reservation>{
 const id=crypto.randomUUID(),month=new Date().toISOString().slice(0,7)
 const saved=await db.prepare("INSERT INTO penny_ai_runs(id,month,capability,provider,model,reserved_micros,state,created_at) SELECT ?,?,?,?,?,?,'reserved',? FROM penny_ai_settings WHERE singleton=1 AND monthly_budget_micros>0 AND monthly_budget_micros>=?+COALESCE((SELECT SUM(COALESCE(actual_micros,reserved_micros)) FROM penny_ai_runs WHERE month=? AND state<>'refused'),0)").bind(id,month,capability,provider,model,upper,new Date().toISOString(),upper,month).run()
 if(!saved.meta.changes)throw new NativeError('ai_budget_exhausted',409,'The monthly AI budget cannot cover this call. Increase the budget in settings or wait for the next UTC month. Manual capture, triage and lexical suggestions remain available.')
 return {id,upper,extraMicros}
}
export async function settle(db:D1Database,r:Reservation,cost:number,input=0,output=0){await db.prepare("UPDATE penny_ai_runs SET state='metered',actual_micros=?,input_tokens=?,output_tokens=? WHERE id=?").bind(cost,input,output,r.id).run()}
export async function failReservation(db:D1Database,r:Reservation,paid:boolean){await db.prepare("UPDATE penny_ai_runs SET state=?,actual_micros=? WHERE id=? AND state='reserved'").bind(paid?'uncertain':'refused',paid?null:0,r.id).run()}
