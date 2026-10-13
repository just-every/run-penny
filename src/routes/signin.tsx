import { loadPublicResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { SignInShell } from '@/core/features/auth/ui/sign-in-shell'

export const Route = createFileRoute('/signin')({
  loader: ({ location }) => loadPublicResources({ data: location.href }),
  component: SignInShell,
})
