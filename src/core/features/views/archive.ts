import {NativeError} from '../auth/native-tokens'
import {privateViewsRefusal} from './export-refusal'

export class PrivateViewExportError extends NativeError {
 readonly count:number
 readonly lowerBound:boolean
 constructor(count:number,lowerBound=false){super('private_views_export_refused',409,privateViewsRefusal(count,lowerBound));this.count=count;this.lowerBound=lowerBound}
}

/** An archive cannot bypass a private view's visibility. A local file exporter
 * has no native viewer; it refuses private definitions rather than disclosing them. */
export function privateViewExport(table:string,row:Record<string,unknown>,creator?:string){
 if(table==='penny_saved_views'&&row.scope==='private'&&(!creator||row.creator_id!==creator))throw new PrivateViewExportError(1,true)
}
export async function viewExportCreator(db:D1Database,nativeId?:string):Promise<string|undefined>{
 if(!nativeId)return undefined
 return await db.prepare('SELECT p.id FROM operators p JOIN oa_operators n ON lower(n.email)=lower(p.email) WHERE n.id=?').bind(nativeId).first<string>('id')??undefined
}
export async function privateViewCount(db:D1Database,creator?:string):Promise<number>{
 const count=await db.prepare("SELECT count(*) AS total FROM penny_saved_views WHERE scope='private' AND (? IS NULL OR creator_id IS NOT ?)").bind(creator??null,creator??null).first<number>('total')
 if(count===null)throw new Error('saved_view_count_unavailable')
 return count
}
export async function assertViewExport(db:D1Database,creator?:string){
 const count=await privateViewCount(db,creator)
 if(count>0)throw new PrivateViewExportError(count)
}
