import {z} from 'zod'

export const importRoadmapSchema=z.object({
 boardIds:z.array(z.string().min(1)).min(1).max(100).refine(ids=>new Set(ids).size===ids.length),
 columns:z.array(z.object({status:z.enum(['under_review','planned','in_progress','shipped']),label:z.string().trim().min(1).max(80),visible:z.boolean()}).strict()).length(4).refine(columns=>new Set(columns.map(c=>c.status)).size===4),
 shippedDays:z.union([z.literal(30),z.literal(90),z.literal(365)]).nullable(),
}).strict()
export type ImportRoadmap=z.infer<typeof importRoadmapSchema>
export const defaultImportColumns:ImportRoadmap['columns']=[{status:'under_review',label:'Under review',visible:true},{status:'planned',label:'Planned',visible:true},{status:'in_progress',label:'In progress',visible:true},{status:'shipped',label:'Shipped',visible:true}]
