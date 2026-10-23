import {z} from 'zod'
import {validateListSearch,type ListQuery} from '../workspace/list-query'
import {NativeError} from '../auth/native-tokens'

export const viewKinds=['requests','evidence','roadmap'] as const
export type ViewKind=typeof viewKinds[number]
export const viewColumns={requests:['title','description','status'],evidence:['wording','status','observedAt','source','account'],roadmap:['title','status','targetWindow','owner']} as const
export const columnLabels:Record<string,string>={title:'Title',wording:'Original wording',description:'Description',status:'Status',observedAt:'Observed time',source:'Source',account:'Account',targetWindow:'Target window',owner:'Owner'}
const text=z.string().trim().min(1).max(160)
export type RoadmapPresentation={layout:'board'|'horizons'|'timeline';grain:'month'|'quarter'}
const filter=z.object({q:z.string().trim().max(200).optional(),tag:text.optional(),account:text.optional(),board:text.optional(),moderation:z.enum(['awaiting_review','approved','rejected']).optional(),status:text.optional(),decision:text.optional(),unreviewed:z.literal(true).optional(),owner:text.optional(),after:text.optional(),before:text.optional(),product:text.optional(),component:text.optional(),customField:text.optional(),customValue:z.string().max(2000).optional()}).strict()
export const viewInput=z.object({listKind:z.enum(viewKinds),name:text,scope:z.enum(['private','shared']),filter,sort:z.enum(['recent','age','name','votes','observed']),columns:z.array(text).min(1).max(5),presentation:z.object({layout:z.enum(['board','horizons','timeline']),grain:z.enum(['month','quarter'])}).strict().optional(),revision:z.number().int().positive().optional()}).strict().superRefine((value,ctx)=>{
 const allowed=value.listKind==='requests'?['q','tag','account','board','moderation','status','decision','owner','after','before','customField','customValue']:value.listKind==='evidence'?['q','tag','account','status','unreviewed','owner','after','before','customField','customValue']:['q','tag','status','owner','product','component','after','before']
 if(Object.keys(value.filter).some(key=>!allowed.includes(key))||value.sort==='votes'&&value.listKind!=='requests'||value.sort==='observed'&&value.listKind!=='evidence')ctx.addIssue({code:'custom',message:'Unsupported list field or sort'})
 if(value.presentation&&value.listKind!=='roadmap')ctx.addIssue({code:'custom',message:'Roadmap presentation requires roadmap items'})
 const columns:readonly string[]=viewColumns[value.listKind]
 if(new Set(value.columns).size!==value.columns.length||value.columns.some(key=>!columns.includes(key))||!value.columns.includes(columns[0]))ctx.addIssue({code:'custom',message:'Choose known columns including the record title'})
 if(Boolean(value.filter.customField)!==(value.filter.customValue!==undefined))ctx.addIssue({code:'custom',message:'Choose a custom field and value together'})
 try{validateListSearch({...value.filter,sort:value.sort})}catch{ctx.addIssue({code:'custom',message:'Invalid filter'})}
 const statuses=value.listKind==='requests'?['unpublished','open','under_review','planned','in_progress','shipped','declined','withdrawn']:value.listKind==='evidence'?['unreviewed','reviewed']:['exploring','planned','in_progress','shipped','dropped']
 if(value.filter.status&&!statuses.includes(value.filter.status))ctx.addIssue({code:'custom',message:'Unsupported list status'})
})
export type ViewInput=z.infer<typeof viewInput>
export interface SavedView extends ViewInput {id:string;creatorId:string|null;creatorName:string;canManage:boolean;revision:number;createdAt:string;updatedAt:string;removedFilters:string[]}
export function definitionQuery(view:ViewInput):ListQuery{return {...view.filter,sort:view.sort}}
export function invalidView():never{throw new NativeError('saved_view_fields_invalid',400)}
