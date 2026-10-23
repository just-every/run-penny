import type {Json} from '@/core/app/resources.server'
export interface PersonRecord {id:string;title:string;href:string;detail?:string;sourceUrl?:string|null}
export interface PersonSection {key:string;label:string;items:PersonRecord[];hasMore:boolean}
export interface PersonProfile {
 id:string;displayName:string;email:string|null;blockedAt:string|null;mergedIntoId:string|null;notificationMutedAt:string|null
 addresses:{id:string;email:string;verifiedAt:string|null;suppressedAt:string|null}[]
 accounts:{id:string;name:string;href:string}[]
 customFields:Json
 page:number;pageSize:number;sections:PersonSection[]
}
export const personHref=(id:string)=>`/app/people/${encodeURIComponent(id)}`
export const requestHref=(id:string,slug:string)=>`/app/moderation?item=${encodeURIComponent(id)}#request-${encodeURIComponent(slug)}`
