import type { Json } from '../../../../base/modules/import-kit/src/types'

// Saved vote objects use these strings. Numeric votes/create parameters are a
// different input protocol, not a saved vote representation.
// https://developers.canny.io/api-reference#vote_object
export const cannyVotePriorities = {
 'Nice to have':1,
 'Important':2,
 'Must have':3,
 'No priority':null,
} as const

export function cannyVoteImportance(value:Json):number|null {
 if(typeof value!=='string'||!Object.hasOwn(cannyVotePriorities,value))throw new Error('Unsupported Canny votePriority; expected Nice to have, Important, Must have or No priority. The original is retained; no importance was inferred.')
 return cannyVotePriorities[value as keyof typeof cannyVotePriorities]
}
