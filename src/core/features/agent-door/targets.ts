import type {NativeTarget} from '../../../../base/modules/agent-door/types.ts'

type RecordLookup={table:string;kind:string;value:string;column:string;owner?:string}
/** Native identifiers come from current authorized rows, never resource links. */
function lookup(name:string,args:Record<string,unknown>,actor:string):RecordLookup|null{
 const id=typeof args.id==='string'?args.id:null,slug=typeof args.slug==='string'?args.slug:null
 if(name.startsWith('evidence.')&&id)return {table:'evidence_items',kind:'evidence',value:id,column:'id'}
 if((name.startsWith('requests.')||name==='notes.add')&&slug)return {table:'requests',kind:'request',value:slug,column:'slug'}
 if(name==='requesters.manage'&&id)return {table:'requesters',kind:'person',value:id,column:'id'}
 if(name.startsWith('decisions.')&&(id||slug))return {table:'decisions',kind:'decision',value:(id??slug)!,column:id?'id':'slug'}
 if(name==='bets.save'&&typeof args.decisionId==='string')return {table:'decisions',kind:'decision',value:args.decisionId,column:'id'}
 if(name.startsWith('roadmap.')&&id)return {table:'roadmap_items',kind:'roadmap-item',value:id,column:'id'}
 if((name.startsWith('releases.')||name==='outcomes.get')&&slug)return {table:'releases',kind:'release',value:slug,column:'slug'}
 if(name==='tags.manage'&&id)return {table:'tags',kind:'tag',value:id,column:'id'}
 if(name==='views.save'&&id)return {table:'penny_priority_views',kind:'prioritisation-view',value:id,column:'id',owner:actor}
 if(name==='planning.save'&&id)return {table:'penny_release_plans',kind:'release-plan',value:id,column:'id'}
 if(name==='settings.board'&&slug)return {table:'boards',kind:'board',value:slug,column:'slug'}
 return null
}
export async function nativeTarget(db:D1Database,name:string,args:Record<string,unknown>,actor:string):Promise<NativeTarget|null>{
 const record=lookup(name,args,actor)
 if(!record)return null
 const row=await db.prepare(`SELECT id FROM ${record.table} WHERE ${record.column}=?${record.owner?' AND owner_id=?':''}`).bind(record.value,...(record.owner?[record.owner]:[])).first<{id:string}>()
 return row?{kind:record.kind,id:row.id}:null
}
