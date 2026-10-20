export type PublicationActor=string|{system:string}
export function publicationActor(actor:PublicationActor|undefined,defaultSystem:string):[string,string]{
 return typeof actor==='string'?['operator',actor]:['system',actor?.system??defaultSystem]
}
