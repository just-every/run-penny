import { readdir, readFile } from 'node:fs/promises'
import { toJSONAsync } from 'seroval'

/** Derive IDs from this build and encode plain input with its matching Seroval protocol. */
export async function generatedTransport() {
  const files = await readdir('dist/server/assets')
  const resolver = await readFile(`dist/server/assets/${files.find((file) => file.startsWith('__23tanstack-start-server-fn-resolver-'))}`, 'utf8')
  const ids = [...resolver.matchAll(/"([a-f0-9]{64})":\s*\{\s*functionName: "(\w+)_createServerFn_handler"/g)]
  if (!ids.length) throw new Error('No generated functions found in the emitted resolver.')
  const encoded: Record<string, string> = {}
  for (const [, id, name] of ids) {
    const data = name === 'loadOperatorResources' ? '/app/customers/northstar-health' : '/portal/feedback'
    const payload = JSON.stringify(await toJSONAsync({ data }))
    encoded[name] = `/_serverFn/${id}?${new URLSearchParams({ payload })}`
  }
  return encoded
}
