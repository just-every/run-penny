import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { DecisionBriefRoute } from '@/core/features/decisions'
import { recordHead } from '@/core/app/page-head'

export const Route = createFileRoute('/app/decisions/$decisionSlug')({ head: ({ loaderData, params }) => recordHead(loaderData, `/api/operator/decisions/${params.decisionSlug}`, 'Decision'),
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: DecisionBriefRoute,
})
