import { createFileRoute, Outlet } from '@tanstack/react-router'
function searchFlag(search: Record<string, unknown>, name: string): boolean { return search[name] === true || search[name] === 'true' }
export const Route = createFileRoute('/app/decisions')({
  validateSearch: (search): { readonly attention?: true } => searchFlag(search, 'attention') ? { attention: true } : {},
  component: Outlet,
})
