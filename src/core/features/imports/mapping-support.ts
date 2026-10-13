import schema from './native-schema.json'
import { canonicalJson, sha256 } from '../../../../base/modules/import-kit/src/d1/index.ts'
import type { Json, SourceRecord, TargetEffect } from '../../../../base/modules/import-kit/src/types.ts'
import type { NativeImportValue } from './types'

export function stableFeedbackId(namespace: string, kind: string, id: string): string {
 let value = BigInt('0x' + sha256(canonicalJson([namespace,kind,id])).slice(0,32)), result = ''
 for (let i=0;i<26;i++) { result = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'[Number(value & 31n)] + result; value >>= 5n }
 return result
}
export const asObject = (value: Json): Record<string,Json> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object'); return value }
export function sourceText(value: Json | undefined, field: string, max=100000): string {
 if (typeof value !== 'string' || !value.trim() || value.length>max) throw new Error('Invalid '+field)
 return value
}
export function sourceTime(value: Json | undefined): string {
 const time = sourceText(value,'created',80)
 if (!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(time) || !Number.isFinite(Date.parse(time))) throw new Error('Invalid original date')
 return time
}
export function reference(value: Json | undefined): string {
 return sourceText(value && typeof value === 'object' && !Array.isArray(value) ? value.id : value,'reference',4096)
}
export function nativeRow(table: string, values: Record<string,Json>): NativeImportValue['rows'][number] {
 const columns = (schema as Record<string,{columns:{name:string;default:string|null}[]}>)[table]?.columns
 if (!columns || Object.keys(values).some(key=>!columns.some(c=>c.name===key))) throw new Error('Unsupported native mapping')
 const defaultValue = (value:string|null):Json => value===null||value==='NULL'?null:/^-?\d+$/.test(value)?Number(value):value.startsWith("'")?value.slice(1,-1).replaceAll("''", "'"):null
 return {table,values:Object.fromEntries(columns.map(column=>[column.name,values[column.name] ?? defaultValue(column.default)]))}
}
export function omissionFields(record: SourceRecord, used: string[]): {field:string;reason:string}[] {
 return Object.keys(asObject(record.payload)).filter(key=>!used.includes(key)).map(field=>({field,reason:'Retained in the private original; not mapped to product behavior.'}))
}
/** The effects a job applied before the namespace joined the evidence label would have written: the label without its
 * namespace segment. A replay of such a job compares against these, so it is still recognised as unchanged. */
export function withoutLabelNamespace(effects: TargetEffect[], namespace: string): TargetEffect[] {
 return effects.map(effect => {
  const value = effect.value as unknown as NativeImportValue
  if (!Array.isArray(value?.rows) || !value.rows.some(row => row.table === 'evidence_items')) return effect
  const rows = value.rows.map(row => row.table === 'evidence_items' && typeof row.values.source_label === 'string' ? { ...row, values: { ...row.values, source_label: row.values.source_label.replace(' · ' + namespace + ' · ', ' · ') } } : row)
  return { ...effect, value: { ...value, rows } as unknown as Json }
 })
}
