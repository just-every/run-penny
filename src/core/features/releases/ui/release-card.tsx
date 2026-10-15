import { Link } from '@tanstack/react-router'
import type { OperatorReleaseCard } from '@/core/shared/api/operator'
import { formatOperatorDate } from '@/core/app/ui/operator-format'
import { OperatorCard, OperatorReleaseState } from '@/core/app/ui/operator-primitives'
import { Icon } from '@/core/ui/app/Icon'
import { Chip } from '@/core/ui/app/Chip'
import { dataLabelClass } from '@/core/ui/app/classes'
import { ReleaseTags } from './release-tags'

export function ReleaseCard({ release }: { readonly release: OperatorReleaseCard }) {
  return <Link to="/app/releases/$releaseSlug" params={{ releaseSlug: release.slug }} className="block min-w-0 rounded-xl"><OperatorCard className="h-full p-5 transition-colors hover:border-penny-line-strong"><div className="flex flex-wrap items-center justify-between gap-3"><OperatorReleaseState state={release.state} /><span className="inline-flex items-center gap-1 text-sm font-semibold text-penny-ink">Open release <Icon name="arrow" /></span></div><h2 className="mt-4 break-words text-xl font-bold tracking-[-0.02em] text-penny-ink">{release.title}</h2><dl className="mt-5 grid gap-4 border-t border-penny-line pt-4 text-sm sm:grid-cols-3"><div><dt className={dataLabelClass}>Type</dt><dd className="mt-1.5"><Chip tone="sand"><span className="capitalize">{release.releaseType}</span></Chip></dd></div><div className="min-w-0"><dt className={dataLabelClass}>Author</dt><dd className="mt-1.5 break-words font-semibold text-penny-ink">{release.author.displayName}</dd></div><div><dt className={dataLabelClass}>{release.state === 'published' ? 'Published' : 'Publication date'}</dt><dd className="mt-1.5 font-semibold text-penny-ink">{formatOperatorDate(release.publicationDate)}</dd></div></dl><ReleaseTags tags={release.tagNames} /></OperatorCard></Link>
}
