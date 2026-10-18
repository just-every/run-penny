export interface Named {id:string;name:string}
export interface Feature extends Named {componentId:string;requests:{id:string;slug:string;title:string}[];roadmap:{id:string;title:string}[];demand:{voters:number;accounts:number;evidence:number;revenueCents:number|null}}
export interface Hierarchy {products:Named[];components:(Named&{productId:string})[];features:Feature[];requests:{id:string;slug:string;title:string}[];roadmap:{id:string;title:string}[]}
