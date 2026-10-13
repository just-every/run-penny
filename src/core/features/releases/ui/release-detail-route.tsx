import { useParams } from '@tanstack/react-router'
import { ReleaseDetailPage } from './release-detail-page'

export function ReleaseDetailRoute() {
  const { releaseSlug } = useParams({ from: '/app/releases/$releaseSlug' })
  return <ReleaseDetailPage releaseSlug={releaseSlug} />
}
