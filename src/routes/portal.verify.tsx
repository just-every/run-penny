import { createFileRoute } from '@tanstack/react-router'
import { publicLandingConfig } from '@/core/app/extension-config'
import { VerifyRequester } from '@/core/features/auth/ui/verify-requester'
import { pageHead } from '@/core/app/page-head'

export const Route = createFileRoute('/portal/verify')({ head: () => pageHead('Verify your email'), component: () => <VerifyRequester content={publicLandingConfig} /> })
