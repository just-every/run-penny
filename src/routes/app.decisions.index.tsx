import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { DecisionsQueuePage } from '@/core/features/decisions'


export const Route = createFileRoute('/app/decisions/')({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: DecisionsQueuePage,
})
