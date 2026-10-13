import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { RoadmapPage } from '@/core/features/roadmap'

function searchFlag(search: Record<string, unknown>, name: string): boolean { return search[name] === true || search[name] === 'true' }

export const Route = createFileRoute('/app/roadmap')({
  validateSearch: (search): { readonly active?: true } => searchFlag(search, 'active') ? { active: true } : {},
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: RoadmapPage,
})
