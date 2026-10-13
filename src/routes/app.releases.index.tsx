import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { ReleasesPage } from '@/core/features/releases'

export const Route = createFileRoute('/app/releases/')({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: ReleasesPage,
})
