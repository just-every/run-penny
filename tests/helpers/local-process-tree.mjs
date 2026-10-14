import { readOwnedTree as native } from '@runeditrun/rer/internal/onboarding/process-tree.mjs'
export const readOwnedTree = (child, previous = [], timeout, scope = previous.scope) => native(child, previous, timeout, scope?.native ?? scope)
