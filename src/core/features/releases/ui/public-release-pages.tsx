import { useState } from 'react'
import { ChangelogFilters,ChangelogLabels } from './changelog-filters'
import { ReleaseMarkdown } from './release-markdown'
import { HydrationUnit } from '@/base/hydration/unit'
import { ReleaseSubscription } from './release-subscription'
import { ReleaseOutcomeForm } from './release-outcome-form'
import { Link } from '@tanstack/react-router'
import type { CurrentPublicRelease as PublicRelease } from '../public-read-repository'
import type { PublicPortalContent } from '@/core/features/portal/ui/public-portal-layout'
import { PublicPortalLayout } from '@/core/features/portal/ui/public-portal-layout'
import { formatPublicDate } from '@/core/features/portal/ui/public-format'
import { PortalIcon, PublicCard, PublicEmpty, ReleaseType, ResourceFailure, ResourceLoading } from '@/core/features/portal/ui/public-primitives'
import { PortalBackLink } from '@/core/features/portal/ui/portal-back-link'
import { PageTitle } from '@/core/ui/app/PageTitle'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import { ledeClass, secondaryButtonClass, textLinkClass } from '@/core/features/portal/ui/portal-classes'

export function PublicUpdatesPage({ content }: { readonly content: PublicPortalContent }) {
  const [label,setLabel]=useState(''),[product,setProduct]=useState('')
  const [releases, retry] = usePublicResource<readonly PublicRelease[]>('/api/public/releases')
  const matches=(release:PublicRelease)=>(!label||release.releaseType===label||release.labels.some(item=>item.id===label))&&(!product||release.products.some(item=>item.id===product))

  return (
    <PublicPortalLayout content={content}>
      <HydrationUnit><section className="mx-auto max-w-3xl" aria-labelledby="updates-heading">
        <header className="min-w-0"><PageTitle id="updates-heading" eyebrow="Updates">Product updates</PageTitle><p className={ledeClass}>Published updates describe shipped customer-facing changes.</p></header>
        <ReleaseSubscription/>{releases.kind==='ready'?<ChangelogFilters releases={releases.data} label={label} product={product} onLabel={setLabel} onProduct={setProduct}/>:null}<div className="mt-8 space-y-4">
          {releases.kind === 'loading' ? <ResourceLoading label="Loading published updates…" /> : null}
          {releases.kind === 'error' ? <ResourceFailure status={releases.status} onRetry={retry} /> : null}
          {releases.kind === 'ready' && releases.data.length === 0 ? <PublicEmpty title="There are no updates yet.">Published updates will appear here.</PublicEmpty> : null}
          {releases.kind==='ready'&&releases.data.length>0&&!releases.data.some(matches)?<PublicEmpty title="No updates match these filters.">Choose another label or product to browse the changelog.</PublicEmpty>:null}
          {releases.kind === 'ready' ? releases.data.filter(matches).map((release) => <ReleaseListItem key={release.slug} release={release} />) : null}
        </div>
      </section></HydrationUnit>
    </PublicPortalLayout>
  )
}

export function PublicReleaseDetailPage({ content, releaseSlug }: { readonly content: PublicPortalContent; readonly releaseSlug: string }) {
  const [release, retry] = usePublicResource<PublicRelease>(`/api/public/releases/${encodeURIComponent(releaseSlug)}`)

  return (
    <PublicPortalLayout content={content}>
      <HydrationUnit><section className="mx-auto max-w-3xl" aria-labelledby="release-detail-heading">
        <PortalBackLink to="/portal/updates">All updates</PortalBackLink>
        <PageTitle id="release-detail-heading" className="mt-3">Product update</PageTitle>
        <div className="mt-7">
          {release.kind === 'loading' ? <ResourceLoading label="Loading product update…" /> : null}
          {release.kind === 'error' ? <ResourceFailure status={release.status} onRetry={retry} /> : null}
          {release.kind === 'ready' ? <ReleaseDetail release={release.data} /> : null}
        </div>
      </section></HydrationUnit>
    </PublicPortalLayout>
  )
}

function ReleaseListItem({ release }: { readonly release: PublicRelease }) {
  return (
    <PublicCard className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3"><ReleaseType type={release.releaseType} /><ChangelogLabels release={release}/><time className="text-sm font-medium text-penny-muted" dateTime={release.publicationDate}>{formatPublicDate(release.publicationDate)}</time></div>
      <h2 className="mt-3 text-xl font-bold tracking-[-0.02em] text-penny-ink"><Link to="/portal/updates/$releaseSlug" params={{ releaseSlug: release.slug }} className="rounded-sm hover:underline hover:decoration-penny-copper hover:underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-penny-accent">{release.title}</Link></h2>
      <div className="mt-2"><ReleaseMarkdown body={release.body} slug={release.slug}/></div>
      <Link to="/portal/updates/$releaseSlug" params={{ releaseSlug: release.slug }} className={`${textLinkClass} mt-3 inline-flex min-h-11 items-center gap-1 text-sm`}>Read update <PortalIcon name="arrow" className="size-4" /></Link>
    </PublicCard>
  )
}

function ReleaseDetail({ release }: { readonly release: PublicRelease }) {
  return (
    <PublicCard className="p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-3"><ReleaseType type={release.releaseType} /><ChangelogLabels release={release}/><time className="text-sm font-medium text-penny-muted" dateTime={release.publicationDate}>{formatPublicDate(release.publicationDate)}</time></div>
      <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.02em] text-penny-ink">{release.title}</h2>
      <p className="mt-3 text-sm text-penny-muted">{release.authorName}{release.versionNumber > 1 ? ` · Corrected (version ${release.versionNumber})` : null}</p>
      <div className="mt-5"><ReleaseMarkdown body={release.body} slug={release.slug}/></div>
      {release.setupUrl ? <a href={release.setupUrl} className={`${secondaryButtonClass} mt-7`}>Learn more <PortalIcon name="external" /></a> : null}
      <ReleaseOutcomeForm slug={release.slug}/>
    </PublicCard>
  )
}
