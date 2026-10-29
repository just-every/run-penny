import { useMemo, useSyncExternalStore } from 'react'

interface Choices { readonly browser: string; readonly zones: readonly string[]; readonly hydrated: boolean }

let known: Choices | undefined
/** What this browser knows: its own zone and every IANA zone it lists (UTC among them), read once. */
const browserChoices = (): Choices => known ??= { browser: Intl.DateTimeFormat().resolvedOptions().timeZone, zones: [...new Set(['UTC', ...Intl.supportedValuesOf('timeZone')])].sort(), hydrated: true }
const subscribe = () => () => {}

/** The zone picker's choices. The server and the first hydration pass know only the saved zone (a server's list is not the
 * browser's, and a different list would fail hydration); the browser's full list follows at once, and `hydrated` says the page's handlers are attached. */
export function useTimezoneChoices(saved: string): Choices {
  const serverChoices = useMemo<Choices>(() => ({ browser: saved, zones: [saved], hydrated: false }), [saved])
  return useSyncExternalStore(subscribe, browserChoices, () => serverChoices)
}
