import { validateListSearch } from '@/core/features/workspace/list-query'
import { ListQueryRefusal } from '@/core/app/ui/list-query-refusal'
import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { AccountsPage } from '@/core/features/accounts'
import { pageHead } from '@/core/app/page-head'

export const Route = createFileRoute('/app/accounts/')({ head: () => pageHead('Accounts'),
  validateSearch: validateListSearch,
  errorComponent: ListQueryRefusal,
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: AccountsPage,
})
