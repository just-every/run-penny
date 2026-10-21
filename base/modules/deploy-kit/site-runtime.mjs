import { assert, hash } from './validation.mjs';

/** Only the immutable Base docs-search bundle may extend the site Worker. */
export function siteRuntime(runtime) {
  if (runtime === undefined) return undefined;
  assert(runtime && typeof runtime === 'object' && !Array.isArray(runtime)
    && Object.keys(runtime).sort().join() === 'bindings,corpusHash,endpoint,model,module,pooling,source,type'
    && runtime.type === 'docs-search' && runtime.module === 'docs-search' && runtime.endpoint === '/docs/search'
    && Array.isArray(runtime.bindings) && runtime.bindings.join() === 'ASSETS,AI'
    && typeof runtime.model === 'string' && runtime.model.trim().length > 0 && runtime.pooling === 'cls'
    && typeof runtime.corpusHash === 'string' && /^[a-f0-9]{64}$/.test(runtime.corpusHash)
    && typeof runtime.source === 'string' && runtime.source.length > 0, 'invalid-site-runtime');
  return { ...runtime, bindings: ['ASSETS', 'AI'] };
}

export const siteRuntimeBindings = runtime => [{ type: 'assets', name: 'ASSETS' }, ...(runtime ? [{ type: 'ai', name: 'AI' }] : [])];

/** Read the exact version, never Worker-scoped settings or seed annotations.
 * Source equality proves the embedded corpus/model/pooling contract, including
 * its executable implementation, rather than trusting a claimed source digest. */
export async function verifySiteRuntime(api, worker, versionId, runtime, module) {
  const replaced = () => Object.assign(new Error('owned-resource-replaced'), { resource: `worker:${worker}` });
  const version = await api.request(`/workers/scripts/${worker}/versions/${versionId}`);
  const bindings = version?.resources?.bindings;
  const expected = siteRuntimeBindings(runtime);
  if (version?.id !== versionId || !Array.isArray(bindings) || bindings.length !== expected.length
    || expected.some(binding => bindings.filter(row => row?.name === binding.name && row.type === binding.type).length !== 1)) throw replaced();
  const content = await api.workerContent(worker, versionId);
  const parts = [...content.parts];
  if (content.entry !== module || parts.length !== 1 || parts[0][0] !== module
    || typeof parts[0][1]?.arrayBuffer !== 'function'
    || hash(Buffer.from(await parts[0][1].arrayBuffer())) !== hash(runtime.source)) throw replaced();
}
