// The predecessor Worker predates Base operator authority and its first-run record: it has no /setup.
import type { PennyRuntime } from '@/core/app/runtime'

export const firstRunDocument = (): Promise<Response | null> => Promise.resolve(null)
export const operatorNeedsFirstRun = (_request: Request, _runtime: PennyRuntime): Promise<boolean> => Promise.resolve(false)
