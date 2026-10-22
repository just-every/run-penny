import { Link } from '@tanstack/react-router'
import type { PublicRoadmapItem } from '@/core/shared/api/public'
import { dataLabelClass, textLinkClass } from '@/core/features/portal/ui/portal-classes'

export function RoadmapReleases({ item }: { readonly item: PublicRoadmapItem }) {
  if (!item.releases?.length) return null
  return <div className="mt-4 border-t border-penny-line pt-3">
    <p className={dataLabelClass}>Released in</p>
    <ul className="mt-2 space-y-1">{item.releases.map(release => <li key={release.slug} className="min-w-0">
      <Link to="/portal/updates/$releaseSlug" params={{ releaseSlug: release.slug }} className={`${textLinkClass} flex min-h-11 min-w-0 items-center text-sm font-medium [overflow-wrap:anywhere]`}>{release.title}</Link>
    </li>)}</ul>
  </div>
}
