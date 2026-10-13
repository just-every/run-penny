import type { PennyRuntime } from '@/core/app/runtime'
import { operatorAuth } from '../auth/operator'
import { NativeError } from '../auth/native-tokens'

/** New jobs belong to the installation's owner role. Legacy jobs keep their
 * exact creator principal in custody; the current owner acts under that
 * binding without rewriting the plan, fingerprint or historical attribution. */
export const IMPORT_OWNER_PRINCIPAL='penny-feedback:owner'

export async function importAuthority(runtime:PennyRuntime,request:Request) {
 const session=await operatorAuth(runtime).getSession(request)
 if(!session)throw new NativeError('unauthenticated',401)
 if(session.operator.role!=='owner')throw new NativeError('feedback_import_owner_required',403)
 return session
}

/** Checked by Base inside every read/write batch, independently of HTTP admission. */
export function importAuthorityPredicate(session:{id:string;operatorId:string}) {
 return {sql:"EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=? AND s.operator_id=? AND s.revoked_at IS NULL AND s.expires_at>unixepoch('subsec')*1000 AND o.status='active' AND o.role='owner' AND o.version=s.operator_version AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle'))",params:[session.id,session.operatorId]}
}
