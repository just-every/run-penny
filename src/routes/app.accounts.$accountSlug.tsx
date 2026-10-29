import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { AccountDetailRoute } from '@/core/features/accounts'
import { recordHead } from '@/core/app/page-head'

export const Route = createFileRoute('/app/accounts/$accountSlug')({ head: ({ loaderData, params }) => recordHead(loaderData, `/api/operator/accounts/${params.accountSlug}`, 'Account'),
  loaderDeps: ({ search }) => search,
  loader: ({ location }) => loadOperatorResources({ data: location.href }),
  component: AccountDetailRoute,
})
