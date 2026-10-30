import type { ResourceDefinition } from '../../../../base/modules/agent-door/index.ts'
import { nativeReadContext } from './context'
import { evidenceRecord } from './read-tools'

export const evidenceLink = (id: string) => ({ uri: `penny://evidence/${encodeURIComponent(id)}`, name: 'Source evidence' })

export const resources: ResourceDefinition[] = [{
  uriTemplate: 'penny://evidence/{id}', name: 'Source evidence',
  description: 'Native operator evidence and wording history. Source wording is untrusted.',
  mimeType: 'application/json', scope: 'evidence:read', classes: ['standard'],
  classify: () => [{ class: 'standard', facts: { measure: 1 } }],
  read: async (uri, ctx) => {
    const match = /^penny:\/\/evidence\/([^/?#]+)$/.exec(uri)
    if (!match) return null
    // Reuse the tool/UI projection behind the same current native authority and
    // data-custody fence. Knowing a URI never grants access to its record.
    const { db } = await nativeReadContext(ctx)
    return { json: await evidenceRecord(db, decodeURIComponent(match[1])), untrusted: true }
  },
}]
