import { validateListSearch } from '@/core/features/workspace/list-query'
import { ListQueryRefusal } from '@/core/app/ui/list-query-refusal'
import { createFileRoute, Outlet } from '@tanstack/react-router'
export const Route = createFileRoute('/app/decisions')({
  validateSearch: validateListSearch,
  errorComponent: ListQueryRefusal,
  component: Outlet,
})
