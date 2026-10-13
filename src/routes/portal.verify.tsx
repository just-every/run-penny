import { createFileRoute } from '@tanstack/react-router'
import { publicLandingConfig } from '@/core/app/extension-config'
import { VerifyRequester } from '@/core/features/auth/ui/verify-requester'

export const Route = createFileRoute('/portal/verify')({ component: () => <VerifyRequester content={publicLandingConfig} /> })
