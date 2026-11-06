import {z} from 'zod'
export const scorecardId=z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/)
const criterion=z.object({
 key:z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),
 name:z.string().trim().min(1).max(100),
 scale:z.union([z.literal(5),z.literal(10)]),
 weight:z.number().finite().min(0).max(1000),
}).strict()
export const definitionInput=z.object({
 name:z.string().trim().min(1).max(100),
 criteria:z.array(criterion).min(1).max(20),
}).strict().refine(value=>new Set(value.criteria.map(c=>c.key)).size===value.criteria.length&&value.criteria.some(c=>c.weight>0),'Criteria need distinct keys and a positive total weight.')
export const versionInput=z.object({previousVersionId:scorecardId,definition:definitionInput}).strict()
export const scoreInput=z.object({versionId:scorecardId,inputs:z.record(z.string(),z.number().int().min(1).max(10))}).strict()
export type Definition=z.infer<typeof definitionInput>
export function validScores(definition:Definition,inputs:Record<string,number>):boolean {
 return Object.entries(inputs).every(([key,value])=>definition.criteria.some(c=>c.key===key&&Number.isInteger(value)&&value>=1&&value<=c.scale))
}
