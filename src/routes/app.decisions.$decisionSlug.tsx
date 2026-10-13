import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { DecisionBriefRoute } from '@/core/features/decisions'

export const Route = createFileRoute('/app/decisions/$decisionSlug')({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: DecisionBriefRoute,
})
