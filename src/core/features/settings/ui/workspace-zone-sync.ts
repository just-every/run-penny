import { useEffect } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { setWorkspaceTimezone } from '@/core/app/ui/workspace-zone'
import type { WorkspaceClock } from '../workspace-clock'

/** Keeps the time zone every operator date is written in equal to the saved workspace zone: set during render, from the
 * route's preloaded clock, so the first paint already reads it, and reloaded when Settings saves a new zone. */
export function useWorkspaceZoneSync(): void {
  const [clock, reload] = useOperatorResource<WorkspaceClock>('/api/operator/settings/workspace-clock')
  useEffect(() => {
    window.addEventListener('penny-workspace-clock-changed', reload)
    return () => window.removeEventListener('penny-workspace-clock-changed', reload)
  }, [reload])
  if (clock.kind === 'ready') setWorkspaceTimezone(clock.data.timezone)
}
