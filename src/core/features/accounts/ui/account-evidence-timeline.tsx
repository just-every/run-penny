import { WorkspaceLink } from '@/core/features/workspace/ui/workspace-link'
import { textLinkClass } from '@/core/ui/app/classes'
import type { OperatorEvidenceCard } from '@/core/shared/api/operator'
import { formatObservedAt, sourceLabel } from '@/core/app/ui/operator-format'
import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { EmptyNote } from '@/core/ui/app/EmptyState'

export function AccountEvidenceTimeline({ evidence }: { readonly evidence: readonly OperatorEvidenceCard[] }) {
  if (evidence.length === 0) return <EmptyNote>No attributed evidence is linked to this account.</EmptyNote>
  return <div className="space-y-3">{evidence.map((item) => <OperatorCard key={item.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs font-semibold tracking-[0.09em] text-penny-accent uppercase">{sourceLabel(item.sourceType, item.sourceLabel)}</span><time className="text-xs font-semibold tabular-nums text-penny-muted" dateTime={item.observedAt}>{formatObservedAt(item.observedAt)}</time></div><p className="mt-3 break-words text-base leading-7 text-penny-ink">“{item.wording}”</p><p className="mt-3 text-xs font-semibold text-penny-muted">{item.requester?.displayName ?? item.namedSpeaker ?? 'No named speaker'} · {item.reviewState === 'unreviewed' ? 'Unreviewed' : 'Reviewed'}</p><WorkspaceLink href={`/app/feedback?item=${encodeURIComponent(item.id)}#evidence-${encodeURIComponent(item.id)}`} className={`${textLinkClass} mt-3 inline-flex min-h-11 items-center text-sm`}>View evidence, versions and private files</WorkspaceLink></OperatorCard>)}</div>
}
