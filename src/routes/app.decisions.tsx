import { validateListSearch } from '@/core/features/workspace/list-query'
import { createFileRoute, Outlet } from '@tanstack/react-router'
export const Route = createFileRoute('/app/decisions')({
  validateSearch: validateListSearch,
  component: Outlet,
})
