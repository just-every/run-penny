import type { PennySample } from './schema'

// Stable, separate from the small import/upgrade sample's ID namespace.
export const demoId = (number: number) => `01DEM0${number.toString(32).toUpperCase().replaceAll('I', 'Y').replaceAll('L', 'Z').replaceAll('O', 'X').replaceAll('U', 'W').padStart(20, '0')}`
export const demoDate = (now: Date, days: number) => new Date(now.getTime() + days * 86_400_000).toISOString()
export const demoOwner = demoId(1)

export function demoContext(now: Date): Pick<PennySample, 'operators' | 'accounts' | 'requesters' | 'boards' | 'tags'> {
  const companies = [
    ['northstar-health', 'Northstar Health', 7200000, 'Security team testing provisioning', 'Priya Shah', 'priya'],
    ['caldera-finance', 'Caldera Finance', 4800000, 'Audit export adopted; expansion review next month', 'Marin Torres', 'marin'],
    ['brightwell', 'Brightwell', 6600000, 'Identity rollout in progress', 'Elena Park', 'elena'],
    ['studio-north', 'Studio North', 1800000, 'Client collaboration design partner', 'Mateo Rivera', 'mateo'],
    ['fieldwork', 'Fieldwork', 2400000, 'Growing team; weekly reporting is manual', 'Jo Chen', 'jo'],
    ['atlas-logistics', 'Atlas Logistics', 5400000, 'Bulk triage saving the support team time', 'Sam Okafor', 'sam'],
  ] as const
  return {
    operators: [{ id: demoOwner, email: 'aisha@example.test', displayName: 'Aisha Khan' }],
    accounts: companies.map(([slug, name, revenueCents, health], index) => ({
      id: demoId(10 + index), slug, name, internalOwnerId: demoOwner, revenueCents,
      renewalDate: demoDate(now, 30 + index * 12).slice(0, 10), health,
    })),
    requesters: companies.map(([, , , , displayName, email], index) => ({
      id: demoId(20 + index), addressId: demoId(30 + index), displayName,
      email: `${email}@example.test`, accountId: demoId(10 + index),
    })),
    boards: [
      { id: demoId(40), slug: 'enterprise-identity', name: 'Enterprise identity', visibility: 'public', position: 1 },
      { id: demoId(41), slug: 'collaboration', name: 'Collaboration', visibility: 'public', position: 2 },
      { id: demoId(42), slug: 'workflow', name: 'Workflow', visibility: 'public', position: 3 },
    ],
    tags: ['Identity', 'Collaboration', 'Reporting', 'Workflow'].map((name, index) => ({ id: demoId(50 + index), name })),
  }
}
