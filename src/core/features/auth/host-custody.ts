import {digest} from './native-tokens'
import type {Row} from '../data/archive'
export const hostEmailHash=(email:string)=>digest('penny-host-email:'+email.trim().toLowerCase())
export async function hostErasureStatements(db:D1Database,selected:Record<string,Row[]>){
 const emails=[...new Set((selected.requester_addresses??[]).map(row=>String(row.email)))]
 return Promise.all(emails.map(async email=>db.prepare('INSERT OR IGNORE INTO host_identity_tombstones(email_hash) VALUES(?)').bind(await hostEmailHash(email))))
}
