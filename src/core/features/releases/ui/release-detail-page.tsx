import { ReleaseMedia } from './release-media'
import { ReleaseMarkdown } from './release-markdown'
import { CustomFieldsEditor } from '@/core/features/settings/ui/custom-fields-editor'
import { ReleaseHistory } from './release-history'
import { ReleaseCoverage } from './release-coverage'
import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import type { OperatorReleaseDetail } from '@/core/shared/api/operator'
import { OperatorDetailBack, OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { formatOperatorDate, roadmapStatusLabel } from '@/core/app/ui/operator-format'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorResourceFailure, OperatorResourceLoading, OperatorResourceNotFound, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { OperatorCard, OperatorReleaseState, OperatorRoadmapStatus } from '@/core/app/ui/operator-primitives'
import { Icon } from '@/core/ui/app/Icon'
import { Chip } from '@/core/ui/app/Chip'
import { primaryButtonClass, textLinkClass } from '@/core/ui/app/classes'
import { operatorMutation } from '@/core/features/requests/ui/operator-client'
import { ReleaseEditor } from './release-editor'
import { DeliveryCounts } from './delivery-counts'
import { ReleaseTags } from './release-tags'
import { PublicationSchedule } from './publication-schedule'

const sectionTitle = 'text-xl font-bold tracking-[-0.02em] text-penny-ink'
const panelTitle = 'text-base font-bold text-penny-ink'

export function ReleaseDetailPage({ releaseSlug }: { readonly releaseSlug: string }) {
  const [release, retry] = useOperatorResource<OperatorReleaseDetail>(`/api/operator/releases/${encodeURIComponent(releaseSlug)}`)
  return <>{release.kind === 'loading' ? <OperatorResourceLoading label="Loading release detail…" /> : null}{release.kind === 'session_expired' ? <OperatorSessionExpired /> : null}{release.kind === 'not_found' ? <ReleaseNotFound /> : null}{release.kind === 'error' ? <OperatorResourceFailure title="We could not load this release." status={release.status} message={release.message} onRetry={retry} /> : null}{release.kind === 'ready' ? <ReleaseContent release={release.data} refresh={retry} /> : null}</>
}

function ReleaseNotFound() {
  return <><OperatorDetailBack to="/app/releases">All releases</OperatorDetailBack><OperatorResourceNotFound title="Release not found">This release may have been removed or its URL is no longer valid.</OperatorResourceNotFound></>
}

function Row({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return <div className="flex justify-between gap-4"><dt className="text-penny-muted">{label}</dt><dd className="text-right font-semibold text-penny-ink">{children}</dd></div>
}

function ReleaseContent({ release, refresh }: { readonly release: OperatorReleaseDetail; readonly refresh: () => void }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const publish = async () => {
    setBusy(true); setMessage('')
    try { await operatorMutation(`/api/operator/releases/${release.slug}/publish`, {}); setMessage('Release published.'); refresh() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Publication failed.') }
    finally { setBusy(false) }
  }
  const unshippedTargets = release.targets.filter((target) => target.roadmapStatus !== 'shipped')
  return <><OperatorDetailBack to="/app/releases">All releases</OperatorDetailBack><OperatorPageHeader eyebrow="Release detail" title={release.title} art={{ note: "It's live — thanks for asking." }}><span>Customer-safe wording is kept separate from the operator-only decision and delivery context.</span></OperatorPageHeader><div className="mt-7 grid min-w-0 grid-cols-1 gap-7 xl:grid-cols-[minmax(0,1fr)_340px]"><div className="min-w-0 space-y-8">{release.state === 'draft' ? <ReleaseEditor slug={release.slug} initial={{ ...release, authorOperatorId: release.author.id }} onSaved={refresh} /> : <OperatorCard className="p-5 sm:p-6"><div className="flex flex-wrap items-center gap-2"><OperatorReleaseState state={release.state} /><Chip tone="sand"><span className="capitalize">{release.releaseType}</span></Chip></div><h2 className={`${sectionTitle} mt-5`}>Customer-safe update</h2><div className="mt-3"><ReleaseMarkdown body={release.body} slug={release.slug}/></div>{release.setupUrl ? <a href={release.setupUrl} className={`${textLinkClass} mt-4 inline-flex min-h-11 items-center gap-2 text-sm`}>Setup or usage link <Icon name="external" /></a> : null}<ReleaseTags tags={release.tagNames} className="mt-5" /></OperatorCard>}<ReleaseMedia slug={release.slug}/>{release.state==='published'?<><ReleaseHistory release={release} onSaved={refresh}/><ReleaseCoverage slug={release.slug}/></>:null}<section aria-labelledby="release-targets"><h2 id="release-targets" className={sectionTitle}>Release targets</h2><div className="mt-3 space-y-3">{release.targets.map((target) => <OperatorCard key={target.roadmapSlug} className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><OperatorRoadmapStatus status={target.roadmapStatus} /><Link to="/app/decisions/$decisionSlug" params={{ decisionSlug: target.decisionSlug }} className={`${textLinkClass} text-sm`}>{target.decisionTitle}</Link></div><h3 className="mt-3 break-words font-bold text-penny-ink">{target.roadmapTitle}</h3><p className="mt-1 text-sm text-penny-muted">{roadmapStatusLabel(target.roadmapStatus)}</p></OperatorCard>)}</div></section></div><aside className="min-w-0 space-y-4"><OperatorCard className="p-5"><h2 className={panelTitle}>Publication readiness</h2><CustomFieldsEditor entityType="release" entityId={release.id}/><dl className="mt-4 space-y-3 text-sm"><Row label="Author">{release.author.displayName}</Row><Row label="Publication">{formatOperatorDate(release.publicationDate)}</Row><Row label="Recipient snapshot">{release.recipientSnapshotCount ?? 'Not created'}</Row></dl>{release.state === 'draft' ? <div className="mt-5 border-t border-penny-line pt-4 text-sm leading-6 text-penny-muted">{unshippedTargets.length > 0 ? <p>{`This draft cannot be published until ${unshippedTargets.map((target) => target.roadmapTitle).join(', ')} ${unshippedTargets.length === 1 ? 'is' : 'are'} Shipped.`}</p> : <p>Publishing makes the wording public, records every eligible recipient once and queues their email.</p>}<button type="button" disabled={busy || unshippedTargets.length > 0} onClick={publish} className={`${primaryButtonClass} mt-4`}>Publish release</button></div> : <p className="mt-5 border-t border-penny-line pt-4 text-sm leading-6 text-penny-muted">Published wording is versioned and never edited.</p>}{message ? <p role="status" className="mt-3 break-words text-sm font-semibold text-penny-ink">{message}</p> : null}{release.state === 'draft' ? <PublicationSchedule path={`/api/operator/releases/${encodeURIComponent(release.slug)}/schedule`} subject="Release" revision={release} disabled={busy} /> : null}</OperatorCard>{release.state === 'published' ? <OperatorCard className="p-5"><h2 className={panelTitle}>Email delivery</h2><DeliveryCounts counts={release.deliveryCounts} /></OperatorCard> : null}<OperatorCard className="p-5"><h2 className={panelTitle}>Requester outcome</h2><p className="mt-3 text-sm leading-6 text-penny-muted">{release.outcomePrompt}</p><p className="mt-4 border-t border-penny-line pt-4 text-sm leading-6 text-penny-muted">{release.state === 'draft' ? 'No outcome responses exist because this release has not been published.' : release.outcomeTotal === 0 ? 'No outcome responses have been recorded.' : `${release.outcomeTotal ?? 0} current outcome response${release.outcomeTotal === 1 ? '' : 's'} recorded.`} Penny does not collect outcome responses from this page.</p></OperatorCard></aside></div></>
}
