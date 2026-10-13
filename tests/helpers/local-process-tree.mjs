import { readOwnedTree as native } from '../../scripts/base-onboarding/process-tree.mjs'
export const readOwnedTree = (child, previous = [], timeout, scope = previous.scope) => native(child, previous, timeout, scope?.native ?? scope)
