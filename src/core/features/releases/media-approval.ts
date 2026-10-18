import { MutationError } from '@/core/app/operator-mutations'
import { releaseImagePath } from './rich-content'
/** Bind approved media in the same transaction that seals customer-safe wording. */
export function releaseMediaGuard(slug:string,body:string){
 const paths=[...new Set(body.match(/\/api\/public\/releases\/[a-z0-9-]+\/attachments\/[0-9A-HJKMNPQRSTVWXYZ]{26}/g)??[])]
 const ids=paths.map(path=>path.slice(path.lastIndexOf('/')+1))
 if(paths.some((path,index)=>path!==releaseImagePath(slug,ids[index])))throw new MutationError(422,'Inline images must belong to this release.')
 return {sql:`NOT EXISTS(SELECT 1 FROM json_each(?) image WHERE NOT EXISTS(SELECT 1 FROM release_attachments a JOIN releases r ON r.id=a.release_id WHERE r.slug=? AND a.id=image.value AND a.state='approved'))`,values:[JSON.stringify(ids),slug]}
}
