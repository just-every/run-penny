export interface LoopHealth {
 ownership:{owned:number;total:number;share:number}
 firstResponse:{medianSeconds:number|null;responded:number;total:number}
 notified:{notified:number;total:number;share:number}
 promises:{atRisk:number}
}
export type LoopHealthMetric='ownership'|'response'|'notified'|'promises'
export interface LoopHealthRecord {id:string;title:string;href:string;detail:string}
export interface LoopHealthPage {metric:LoopHealthMetric;page:number;pageSize:number;total:number;items:LoopHealthRecord[]}
