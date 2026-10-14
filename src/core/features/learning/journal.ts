import type {AuthorityGuard} from '../integrations/guarded-database'

/** A scoped grant checkpoint invalidates older archives without declaring the
 * underlying source/person erased. It is a journal event, not a deleted row. */
export const GRANT_REVOCATION_CHECKPOINT='learning_grant_revocations'

/** Only fully accounted-for grant revocations may advance during another run.
 * Actual erasure, restore, origin changes and missing journal epochs still fence it. */
export function learningRunJournalGuard(origin:string,epoch:number):AuthorityGuard{
 return {sql:`EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND s.origin=? AND s.phase='idle' AND s.epoch>=?
  AND NOT EXISTS(SELECT 1 FROM data_tombstones t WHERE t.epoch>? AND t.epoch<=s.epoch AND t.table_name<>?)
  AND (SELECT COUNT(DISTINCT t.epoch) FROM data_tombstones t WHERE t.epoch>? AND t.epoch<=s.epoch)=s.epoch-?)`,params:[origin,epoch,epoch,GRANT_REVOCATION_CHECKPOINT,epoch,epoch]}
}
