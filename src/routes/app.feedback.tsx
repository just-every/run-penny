import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { EvidenceInboxPage } from '@/core/features/evidence'

function searchFlag(search: Record<string, unknown>, name: string): boolean { return search[name] === true || search[name] === 'true' }

export const Route = createFileRoute('/app/feedback')({
  validateSearch: (search): { readonly unreviewed?: true } => searchFlag(search, 'unreviewed') ? { unreviewed: true } : {},
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: EvidenceInboxPage,
})
