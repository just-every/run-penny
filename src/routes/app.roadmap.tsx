import { validateListSearch } from '@/core/features/workspace/list-query'
import { ListQueryRefusal } from '@/core/app/ui/list-query-refusal'
import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { RoadmapPage } from '@/core/features/roadmap'
import { pageHead } from '@/core/app/page-head'


export const Route = createFileRoute('/app/roadmap')({ head: () => pageHead('Roadmap'),
  validateSearch: validateListSearch,
  errorComponent: ListQueryRefusal,
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: RoadmapPage,
})
