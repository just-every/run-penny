import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { OverviewPage } from '@/core/features/overview'

export const Route = createFileRoute('/app/')({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: OverviewPage,
})
