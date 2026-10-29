import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { AccountDetailRoute } from '@/core/features/accounts'

export const Route = createFileRoute('/app/accounts/$accountSlug')({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: AccountDetailRoute,
})
