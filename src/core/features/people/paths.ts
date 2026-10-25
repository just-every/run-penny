/** Person documents share the existing customer-detail route. The uppercase
 * native requester ID distinguishes them from generated lowercase account slugs. */
export const personHref=(id:string)=>'/app/customers/people-'+id
export function personIdFromPath(path:string){return /^\/app\/customers\/people-([0-9A-HJKMNPQRSTVWXYZ]{26})$/.exec(path)?.[1]??null}
