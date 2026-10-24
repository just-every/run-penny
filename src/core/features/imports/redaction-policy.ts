import type {D1ImportContext,SourceArtifact} from '../../../../base/modules/import-kit/src/d1/index'
import {canonicalJson,sha256} from '../../../../base/modules/import-kit/src/d1/index'
import {NativeError} from '../auth/native-tokens'
import type {redactionSettings} from '../redaction/settings'

export type ImportRedactionPolicy=Awaited<ReturnType<typeof redactionSettings>>
const prefix='penny-redaction-policy-'
export function policyArtifact(revision:number):SourceArtifact {
 const body=canonicalJson({enabled:true,revision})
 return {name:prefix+revision+'.json',sha256:sha256(body),size:new TextEncoder().encode(body).length,original:{status:'unavailable',reason:'not-supplied'}}
}
export const policyArtifactName=(name:string)=>name.startsWith(prefix)
export function redactedArtifacts(artifacts:Pick<SourceArtifact,'name'|'sha256'|'size'>[]):boolean {
 return artifacts.some(artifact=>{const match=/^penny-redaction-policy-(0|[1-9][0-9]*)\.json$/.exec(artifact.name);if(!match||!Number.isSafeInteger(Number(match[1])))return false;const expected=policyArtifact(Number(match[1]));return artifact.sha256===expected.sha256&&artifact.size===expected.size})
}
/** Every Base transaction checks the revision captured before source preparation. */
export function policyContext(context:D1ImportContext,revision:number):D1ImportContext {
 const predicate=context.authorization.predicate
 return {...context,authorization:{...context.authorization,predicate(action,destination){const guard=predicate(action,destination);return {sql:`(${guard.sql}) AND COALESCE((SELECT revision FROM penny_redaction_settings WHERE singleton=1),0)=?`,params:[...guard.params??[],revision]}}}}
}
/** Resume uses the policy that prepared the persisted source. Historical jobs
 * have no marker and may continue only with rules off. */
export async function admitPolicyResume(id:string,context:D1ImportContext,policy:ImportRedactionPolicy):Promise<void>{
 const rows=(await context.storage.database.prepare('SELECT DISTINCT name,sha256,size FROM ik_originals WHERE job_id IN (SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=? UNION SELECT ?) AND name GLOB ?').bind(id,id,prefix+'*').all<{name:string;sha256:string;size:number}>()).results
 const expected=policyArtifact(policy.revision)
 if(policy.enabled?(rows.length!==1||rows[0].name!==expected.name||rows[0].sha256!==expected.sha256||rows[0].size!==expected.size):rows.length!==0)throw new NativeError('feedback_redaction_policy_changed',409,'Redaction rules changed since this import was reviewed. Its stored source cannot be resumed under different rules; undo it or review a new import.')
}
