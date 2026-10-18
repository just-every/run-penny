import { audit } from '../decisions/write-support'
import { z } from 'zod'
import { MutationError } from '@/core/app/operator-mutations'
import { createUlid } from '@/core/shared/ulid'
import type { PublicReleaseLabel,PublicReleaseProduct } from './rich-content'
export const releaseLabelSchema=z.object({name:z.string().trim().min(1).max(80).refine(name=>!['new','improved','fixed'].includes(name.toLowerCase()),'Choose a custom label name.')}).strict()
export const releaseFiltersSchema=z.object({label:z.string().min(1).max(128).optional(),product:z.string().min(1).max(128).optional()}).strict()
export type ReleaseFilters=z.infer<typeof releaseFiltersSchema>
export async function releaseLabels(db:D1Database){return (await db.prepare('SELECT id,name FROM release_labels ORDER BY name').all<PublicReleaseLabel>()).results}
export async function createReleaseLabel(db:D1Database,name:string,actor:string){
 const id=createUlid(),now=new Date().toISOString()
 if(await db.prepare('SELECT id FROM release_labels WHERE name=? COLLATE NOCASE').bind(name).first())throw new MutationError(409,'A public label with that name already exists.')
 try{await db.batch([db.prepare('INSERT INTO release_labels(id,name,created_at,updated_at) VALUES(?,?,?,?)').bind(id,name,now,now),audit(db,actor,'release_label',id,'release.label_created',now)])}catch(error){if(String(error).includes('UNIQUE constraint'))throw new MutationError(409,'A public label with that name already exists.');throw error}
 return {id,name}
}
export async function selectedReleaseLabels(db:D1Database,ids:readonly string[]){
 const result=await db.prepare('SELECT id,name FROM release_labels WHERE id IN (SELECT value FROM json_each(?)) ORDER BY name').bind(JSON.stringify([...new Set(ids)])).all<PublicReleaseLabel>()
 if(result.results.length!==new Set(ids).size)throw new MutationError(422,'Choose existing public labels.')
 return result.results
}
/** Product names become public wording only when the operator explicitly selects them. */
export async function selectedReleaseProducts(db:D1Database,ids:readonly string[]){
 const rows=await db.prepare('SELECT id,name FROM penny_products WHERE id IN (SELECT value FROM json_each(?)) ORDER BY name,id').bind(JSON.stringify([...new Set(ids)])).all<PublicReleaseProduct>()
 if(rows.results.length!==new Set(ids).size)throw new MutationError(422,'Choose existing public product labels.')
 return rows.results
}
