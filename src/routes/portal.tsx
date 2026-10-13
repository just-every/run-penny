import { createFileRoute } from '@tanstack/react-router'
import { PublicPortalOutlet } from '@/core/features/home/ui/public-landing'

export const Route = createFileRoute('/portal')({
  component: PublicPortalOutlet,
})
