import {z} from 'zod'
export const scorecardId=z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/)
export const criterionInput=z.object({name:z.string().trim().min(1).max(80),scale:z.union([z.literal(5),z.literal(10)]),weight:z.number().finite().positive().max(1000)}).strict()
export const scorecardInput=z.object({name:z.string().trim().min(1).max(120),entity:z.enum(['requests','features']),criteria:z.array(criterionInput).min(1).max(20)}).strict()
export const scoreInput=z.object({versionId:scorecardId,values:z.array(z.number().int().positive()).min(1).max(20)}).strict()
export type Criterion=z.infer<typeof criterionInput>
export type ScorecardInput=z.infer<typeof scorecardInput>
export interface Scorecard {id:string;name:string;entity:'requests'|'features';revision:number}
export interface ScoreVersion {id:string;revision:number;criteria:Criterion[]}
export interface ScorerInput {id:string;ideaId:string;versionId:string;scorer:string;own:boolean;values:number[];result:number}
export interface ScorecardResult extends Scorecard {canDefine:boolean;versions:ScoreVersion[];rows:{id:string;title:string;score:number|null}[];submissions:ScorerInput[]}
/** Normalize each scale before weighting; average only complete submissions. */
export function weightedResult(criteria:Criterion[],values:number[]):number {
 return criteria.reduce((sum,c,index)=>sum+100*values[index]/c.scale*c.weight,0)/criteria.reduce((sum,c)=>sum+c.weight,0)
}
