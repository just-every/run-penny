import { useSyncExternalStore } from 'react'

const subscribeNever = () => () => {}

/** False while React hydrates server-rendered markup, true once it has attached (at once for a client-side mount).
 * A server-rendered form pressed before then submits natively, as a GET carrying its fields in the address. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false)
}
