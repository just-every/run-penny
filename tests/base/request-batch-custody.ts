import {expect} from 'vitest'
import type {Archive} from '../../src/core/features/data/archive'
import {call,env} from './support'
import type {Cookie} from './ownership-fixture'
export function assertBatchArchive(archive:Archive,id:string){
 expect(archive.tables.penny_request_batches.find(row=>row.id===id)?.held).toBe(1)
 expect(archive.tables.penny_request_batch_items).toHaveLength(1)
}
export async function assertRestoredBatchHeld(cookie:Cookie,id:string){
 expect((await call(`/api/operator/triage/batches/${id}/undo`,{},cookie)).status).toBe(409)
}
export async function assertBatchErased(id:string){
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_request_batch_items WHERE request_id=?').bind(id).first('n')).toBe(0)
}
