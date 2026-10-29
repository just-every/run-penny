import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { ReleaseDetailRoute } from '@/core/features/releases'
import { recordHead } from '@/core/app/page-head'

export const Route = createFileRoute('/app/releases/$releaseSlug')({ head: ({ loaderData, params }) => recordHead(loaderData, `/api/operator/releases/${params.releaseSlug}`, 'Release'),
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: ReleaseDetailRoute,
})
