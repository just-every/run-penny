import { createFileRoute } from '@tanstack/react-router'
import { redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/portal/')({
  beforeLoad: () => { throw redirect({ to: '/portal/feedback' }) },
})
