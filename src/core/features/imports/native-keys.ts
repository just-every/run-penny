import schema from './native-schema.json'
import type { Json } from '../../../../base/modules/import-kit/src/types.ts'
import type { NativeImportValue } from './types'
export interface NativeKey { table:string; keys:Record<string,Json> }
export const quote = (name:string) => { if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))throw new Error('IMPORT_NATIVE_SCHEMA');return '"'+name+'"' }
export function rowKey(row:NativeImportValue['rows'][number]):NativeKey {
 const definition=(schema as Record<string,{keys:string[];columns:{name:string}[]}>)[row.table]
 if(!definition)throw new Error('IMPORT_NATIVE_SCHEMA')
 const keys=definition.keys.length?definition.keys:row.table==='request_merge_comment_transfers'?['merge_id','comment_id']:definition.columns.map(c=>c.name)
 return {table:row.table,keys:Object.fromEntries(keys.map(key=>[key,row.values[key]]))}
}
export function keyPredicate(key:NativeKey,alias=''): {sql:string;params:unknown[]} {
 if(!(schema as Record<string,unknown>)[key.table]||!Object.keys(key.keys).length)throw new Error('IMPORT_NATIVE_SCHEMA')
 return {sql:Object.keys(key.keys).map(column=>(alias?alias+'.':'')+quote(column)+' IS ?').join(' AND '),params:Object.values(key.keys)}
}
