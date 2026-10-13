import { useParams } from '@tanstack/react-router'
import type { PublicPortalContent } from './public-portal-layout'
import { PublicFeedbackDetailPage } from '@/core/features/requests/ui/public-feedback-pages'
import { PublicReleaseDetailPage } from '@/core/features/releases/ui/public-release-pages'

export function PublicFeedbackDetailRoute({ content }: { readonly content: PublicPortalContent }) {
  const { requestSlug } = useParams({ from: '/portal/feedback/$requestSlug' })
  return <PublicFeedbackDetailPage content={content} requestSlug={requestSlug} />
}

export function PublicReleaseDetailRoute({ content }: { readonly content: PublicPortalContent }) {
  const { releaseSlug } = useParams({ from: '/portal/updates/$releaseSlug' })
  return <PublicReleaseDetailPage content={content} releaseSlug={releaseSlug} />
}
