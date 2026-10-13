import { validateListSearch } from '@/core/features/workspace/list-query'
import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { DecisionsQueuePage } from '@/core/features/decisions'


export const Route = createFileRoute('/app/decisions/')({
  validateSearch: validateListSearch,  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: DecisionsQueuePage,
})
