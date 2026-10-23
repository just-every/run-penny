import {NativeError} from '../auth/native-tokens'

/** An archive cannot bypass a private view's visibility. A local file exporter
 * has no native viewer; it refuses private definitions rather than disclosing them. */
export function privateViewExport(table:string,row:Record<string,unknown>,creator?:string){
 if(table==='penny_saved_views'&&row.scope==='private'&&(!creator||row.creator_id!==creator))throw new NativeError('private_views_export_refused',409)
}
export async function viewExportCreator(db:D1Database,nativeId?:string):Promise<string|undefined>{
 if(!nativeId)return undefined
 return await db.prepare('SELECT p.id FROM operators p JOIN oa_operators n ON lower(n.email)=lower(p.email) WHERE n.id=?').bind(nativeId).first<string>('id')??undefined
}
export async function assertViewExport(db:D1Database,creator?:string){
 const privateView=await db.prepare("SELECT 1 FROM penny_saved_views WHERE scope='private' AND (? IS NULL OR creator_id IS NOT ?) LIMIT 1").bind(creator??null,creator??null).first()
 if(privateView)throw new NativeError('private_views_export_refused',409)
}
