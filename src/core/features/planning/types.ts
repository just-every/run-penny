export interface PlanningItem {
 id:string; title:string; status:string; targetWindow:string|null; publicEta:string|null;
 blockers:string[]; dependents:string[]; risks:{id:string;title:string;reason:string}[]
}
export interface ReleasePlan {id:string;name:string;releaseDate:string;revision:number;itemIds:string[]}
export interface Planning {items:PlanningItem[];plans:ReleasePlan[];today:string}
