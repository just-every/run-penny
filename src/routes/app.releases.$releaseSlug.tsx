import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { ReleaseDetailRoute } from '@/core/features/releases'

export const Route = createFileRoute('/app/releases/$releaseSlug')({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: ReleaseDetailRoute,
})
