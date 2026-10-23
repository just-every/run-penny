import { assert, uuid } from './validation.mjs';
import { activeWorker } from './worker.mjs';
import { checkResourceIdentity, readOwnerState, sameDeployment, withStateLock, ownerResourceName } from './owner.mjs';
import { retiredInstallationKeys } from '../dependencies/custody.mjs';

/** The D1 REST batch is one transaction, matching the Worker's db.batch contract.
 * Nothing from query responses/errors is allowed into deployment diagnostics. */
function database(api, id) {
 const execute = async body => {
  try {
   const rows = await api.request(`/d1/database/${id}/query`, { method: 'POST', body });
   assert(Array.isArray(rows) && rows.every(row => row?.success === true && Array.isArray(row.results)), 'dependency-rekey-invalid-result');
   return rows;
  } catch { throw new Error('dependency-rekey-query-failed'); }
 };
 const prepare = (sql, params = []) => ({
  sql, params,
  bind(...values) { return prepare(sql, values); },
  async all() { return (await execute({sql, params}))[0]; },
  async first() { return (await this.all()).results[0] ?? null; },
  async run() { return (await execute({sql, params}))[0]; },
 });
 return { prepare, batch: statements => statements.length ? execute({batch:statements.map(({sql,params}) => ({sql,params}))}) : Promise.resolve([]) };
}

/** Reseal the dependency rows in the declared DB only while the receipt still
 * proves both the Worker and its recorded D1 resource belong to this deployment. */
export async function ownerRekey({ api, target, statePath, declaration, env, notice = line => console.error(line) }) {
 return withStateLock(statePath, async () => {
  const state = await readOwnerState(statePath, target);
  assert(state.receipt && !state.pendingUpload && !state.pendingSecret, 'missing-owner-receipt');
  const owned = async () => {
   const live = await activeWorker(api, target.worker);
   assert(live && sameDeployment(live, state.receipt.provider), 'owned-resource-replaced');
   return live;
  };
  const live = await owned();
  const binding = declaration.d1?.find(item => item.binding === 'DB');
  assert(binding, 'dependency-rekey-missing-database');
  const name = ownerResourceName(target.worker, binding.binding), entry = state.owned.d1[name];
  assert(entry?.status === 'created' && uuid(entry.id), 'dependency-rekey-missing-database');
  const resource = await api.request(`/d1/database/${entry.id}`);
  checkResourceIdentity('d1', name, resource, entry);
  assert(resource?.name === name, 'owned-resource-replaced');
  assert(live.settings?.bindings?.some(item => item.name === binding.binding && item.type === 'd1' && item.id === entry.id), 'dependency-rekey-database-mismatch');
  const config = {};
  for (const key of ['INSTALLATION_KEY', 'INSTALLATION_KEY_PREVIOUS']) {
   const secret = declaration.secrets?.find(item => item.binding === key);
   assert(secret && typeof env[secret.environment] === 'string' && env[secret.environment].trim(), 'dependency-rekey-missing-key');
   config[key] = env[secret.environment];
   assert(live.settings?.bindings?.some(item => item.name === key && item.type === 'secret_text'), 'dependency-rekey-missing-key');
  }
  let result;
  try {
   const { resealDependencyKeys } = await import('../dependencies/store.mjs');
   const retired = await retiredInstallationKeys(env.INSTALLATION_KEY_RETIRED);
   result = await resealDependencyKeys(database(api, entry.id), config, {
    retiredKeys:[...retired.values()],
    report: status => {
     // D1 is untrusted: only well-formed public key IDs enter diagnostics.
     const publicId = kid => /^[A-Za-z0-9_-]{43}$/.test(kid) ? kid : '(invalid key ID)';
     notice(`D1 key_ids tail: ${status.tail === null ? '(empty)' : publicId(status.tail)}; custody: ${status.custody.map(({kid,available}) => `${publicId(kid)}=${available ? 'in custody' : 'unavailable'}`).join(', ') || '(empty)'}`);
    },
   });
  } catch { throw new Error('dependency-rekey-failed'); }
  await owned();
  return { ok: true, resealed: result.resealed };
 });
}
