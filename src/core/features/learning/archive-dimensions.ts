import type { Observation } from './schema'
import type { validateLearning } from './validation'

type Interpretation = ReturnType<typeof validateLearning>

/** Compare computed dimensions without rewriting historical artifacts or originals. */
export function comparableDimensions(saved: Interpretation, derived: Interpretation, observations: Observation[]): Interpretation {
 return { ...saved, options: saved.options.map((option, index) => {
  const latest = option.latestObservedAt, expected = derived.options[index].latestObservedAt
  // A historical tie may have selected another exact source spelling of the
  // same instant. An invented spelling or an older observation is not valid.
  if (typeof latest !== 'string' || !observations.some(o => option.supportingObservationIds.includes(o.id) && o.observed_at === latest) || Date.parse(latest) !== Date.parse(expected ?? '')) throw new Error('unsupported-latest-observation')
  return { ...option,
   affectedRequesters: [...option.affectedRequesters].sort(),
   affectedAccounts: [...option.affectedAccounts].sort(),
   contradictingEvidence: [...option.contradictingEvidence].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
   latestObservedAt: expected,
  }
 }) }
}
