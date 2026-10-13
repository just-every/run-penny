import { validateListSearch } from '@/core/features/workspace/list-query'
import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { RoadmapPage } from '@/core/features/roadmap'


export const Route = createFileRoute('/app/roadmap')({
  validateSearch: validateListSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: RoadmapPage,
})
