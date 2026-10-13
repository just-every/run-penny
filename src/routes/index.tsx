import { createFileRoute } from '@tanstack/react-router'
import { copy } from '@/core/features/landing/copy'
import { Landing } from '@/core/features/landing/Landing'

/**
 * HOME-002. Penny's public product landing, rendered on the server per request like every other public document. It reads
 * no workspace data; the public board lives under /portal.
 */
export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: copy.meta.title },
      { name: 'description', content: copy.meta.description },
    ],
  }),
  component: Landing,
})
