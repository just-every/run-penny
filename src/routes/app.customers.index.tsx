import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { AccountsPage } from '@/core/features/accounts'

export const Route = createFileRoute('/app/customers/')({
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: AccountsPage,
})
