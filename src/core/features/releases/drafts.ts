import { z } from 'zod'
import { MutationError } from '@/core/app/operator-mutations'
import { publicationGuard } from './publication-policy'
import { createUlid } from '@/core/shared/ulid'
export const releaseDraftSchema=z.object({title:z.string().trim().max(300),body:z.string().trim().max(30000),releaseType:z.enum(['new','improved','fixed']),tagIds:z.array(z.string().min(1)).min(1),publicationDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const parsed=new Date(value+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value}),setupUrl:z.union([z.url().refine(v=>/^https?:\/\//.test(v)),z.literal('')]).optional(),targetIds:z.array(z.string().min(1)),authorOperatorId:z.string().min(1)}).strict()
export type ReleaseDraft=z.infer<typeof releaseDraftSchema>
export async function saveReleaseDraft(db:D1Database,input:ReleaseDraft,slug?:string,now=new Date().toISOString(),actorId?:string){
 const old=slug?await db.prepare('SELECT id,current_version_id AS versionId,state FROM releases WHERE slug=?').bind(slug).first<{id:string;versionId:string;state:string}>():null
 if(slug&&!old)throw new MutationError(404,'Release not found.')
 if(old?.state==='published')throw new MutationError(409,'Published wording is immutable.')
 const missing:string[]=[]
 if(!await db.prepare('SELECT id FROM operators WHERE id=?').bind(input.authorOperatorId).first())missing.push('Author')
 for(const tag of new Set(input.tagIds))if(!await db.prepare('SELECT id FROM tags WHERE id=?').bind(tag).first())missing.push(`Tag ${tag}`)
 for(const item of new Set(input.targetIds))if(!await db.prepare(`SELECT i.id FROM roadmap_items i JOIN roadmap_publications p ON p.roadmap_item_id=i.id AND p.approved_at IS NOT NULL AND p.withdrawn_at IS NULL WHERE i.id=? AND i.decision_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM roadmap_request_mappings m WHERE m.roadmap_item_id=i.id AND m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL)`).bind(item).first())missing.push(`Target ${item}: decision and approved request mappings`)
 if(missing.length)throw new MutationError(422,`Required: ${missing.join('; ')}.`)
 const id=old?.id??createUlid(),versionId=old?.versionId??createUlid(),releaseSlug=slug??`release-${id.toLowerCase()}`
 const guard=createUlid()
 await db.batch([
  publicationGuard(db,guard,`NOT EXISTS(SELECT 1 FROM releases WHERE id=? AND state!='draft') AND EXISTS(SELECT 1 FROM operators WHERE id=?)
   AND NOT EXISTS(SELECT 1 FROM json_each(?) tag WHERE NOT EXISTS(SELECT 1 FROM tags WHERE id=tag.value))
   AND NOT EXISTS(SELECT 1 FROM json_each(?) selected WHERE NOT EXISTS(SELECT 1 FROM roadmap_items i JOIN roadmap_publications p ON p.roadmap_item_id=i.id
    WHERE i.id=selected.value AND i.decision_id IS NOT NULL AND p.approved_at IS NOT NULL AND p.withdrawn_at IS NULL
    AND EXISTS(SELECT 1 FROM roadmap_request_mappings m WHERE m.roadmap_item_id=i.id AND m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL)))`,[id,input.authorOperatorId,JSON.stringify(input.tagIds),JSON.stringify(input.targetIds)]),
  ...(old?[]:[db.prepare("INSERT INTO releases(id,slug,state,current_version_id,author_operator_id,created_at,updated_at) VALUES (?,?,'draft',?,?,?,?)").bind(id,releaseSlug,versionId,input.authorOperatorId,now,now)]),
  db.prepare(`INSERT INTO release_versions(id,release_id,version_number,title,release_type,body,publication_date,setup_url,outcome_prompt,subject_tags_json,is_portal_current,created_at,updated_at)
   VALUES (?,?,1,?,?,?,?,?,'Have you adopted this update?',?,0,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,release_type=excluded.release_type,body=excluded.body,publication_date=excluded.publication_date,setup_url=excluded.setup_url,subject_tags_json=excluded.subject_tags_json,updated_at=excluded.updated_at
   WHERE EXISTS(SELECT 1 FROM releases WHERE id=excluded.release_id AND state='draft')`).bind(versionId,id,input.title,input.releaseType,input.body,input.publicationDate,input.setupUrl||null,JSON.stringify([...new Set(input.tagIds)]),now,now),
  db.prepare("UPDATE releases SET author_operator_id=?,updated_at=? WHERE id=? AND state='draft'").bind(input.authorOperatorId,now,id),
  db.prepare("DELETE FROM release_draft_mappings WHERE release_id=? AND EXISTS(SELECT 1 FROM releases WHERE id=? AND state='draft')").bind(id,id),
  db.prepare("DELETE FROM release_targets WHERE release_id=? AND EXISTS(SELECT 1 FROM releases WHERE id=? AND state='draft')").bind(id,id),
  ...[...new Set(input.targetIds)].flatMap(item=>[
   db.prepare(`INSERT INTO release_targets(release_id,roadmap_item_id,decision_id,approval_id,approval_at,approval_updated_at,public_title,public_summary,public_slug,created_at,updated_at)
   SELECT ?,i.id,i.decision_id,p.id,p.approved_at,p.updated_at,p.public_title,p.public_summary,p.public_slug,?,?
   FROM roadmap_items i JOIN roadmap_publications p ON p.roadmap_item_id=i.id WHERE i.id=?`).bind(id,now,now,item),
   db.prepare(`INSERT INTO release_draft_mappings(release_id,roadmap_item_id,request_id,approval_at,approval_updated_at,created_at,updated_at)
   SELECT ?,roadmap_item_id,request_id,approved_at,updated_at,?,? FROM roadmap_request_mappings WHERE roadmap_item_id=? AND approved_at IS NOT NULL AND withdrawn_at IS NULL`).bind(id,now,now,item),
  ]),
  db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,?,?,?,'release',?,?,?,?)`).bind(createUlid(),actorId?'operator':'system',actorId??'release.drafts',old?'release.draft_replaced':'release.draft_created',id,now,now,now),
  db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(guard),
 ])
 return {id,slug:releaseSlug,versionId}
}
