import { NativeError } from '../auth/native-tokens'
import type { IdeasColumns } from './types'

export class FeedbackSourceError extends NativeError {
 readonly headings:string[]
 constructor(message:string,headings:string[]){super(message,422);this.headings=headings}
}

export function ideasRows(rows:Record<string,string>[],columns:IdeasColumns|undefined,headings:string[]):Record<string,unknown>[] {
 if(!columns)throw new FeedbackSourceError('Ideas CSV needs explicit key, title, details, status and created heading mappings. Canny does not guarantee an identifier column.',headings)
 const required=['key','title','details','status','created'] as const
 const missingMappings=required.filter(key=>!columns[key])
 if(missingMappings.length)throw new FeedbackSourceError('Missing Ideas heading mapping: '+missingMappings.join(', '),missingMappings)
 const selected=[...required.map(key=>columns[key]),...(columns.author?[columns.author]:[]),...Object.keys(columns.aggregates??{}),...(columns.omissions??[])]
 if(new Set(selected).size!==selected.length)throw new FeedbackSourceError('Each Ideas heading must have exactly one meaning.',selected)
 const missing=selected.filter(name=>!headings.includes(name))
 if(missing.length)throw new FeedbackSourceError('Missing Ideas heading: '+missing.join(', '),missing)
 const unknown=headings.filter(name=>!selected.includes(name))
 if(unknown.length)throw new FeedbackSourceError('Unknown Ideas heading: '+unknown.join(', ')+'. Explicitly map documented aggregate categories or name retained-only omissions in the manifest.',unknown)
 return rows.map(row=>{
  if(!row[columns.key]?.trim())throw new FeedbackSourceError('Ideas stable source key is empty in heading '+columns.key,[columns.key])
  const aggregates=Object.entries(columns.aggregates??{}).map(([field,category])=>{
   const raw=row[field]
   if(category==='count'&&(!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw))))throw new FeedbackSourceError('Invalid aggregate count in heading '+field,[field])
   if(category==='revenue'&&(!/^\d+(?:\.\d+)?$/.test(raw)||!Number.isFinite(Number(raw))))throw new FeedbackSourceError('Invalid aggregate revenue in heading '+field,[field])
   return {field,category,value:category==='company'?raw:Number(raw)}
  })
  return {...row,_idea:{key:row[columns.key],title:row[columns.title],details:row[columns.details],status:row[columns.status],created:row[columns.created],...(columns.author?{author:row[columns.author]}:{}),aggregates,omissions:columns.omissions??[]}}
 })
}
