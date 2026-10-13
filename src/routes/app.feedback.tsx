import { validateListSearch } from '@/core/features/workspace/list-query'
import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { EvidenceInboxPage } from '@/core/features/evidence'


export const Route = createFileRoute('/app/feedback')({
  validateSearch: validateListSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: EvidenceInboxPage,
})
