import {loadEditorAdmission} from '@/core/features/editor/admission'
import { createRootRoute } from '@tanstack/react-router'
import { publicLandingConfig } from '@/core/app/extension-config'
import { PennyNotFound } from '@/core/app/root-layout'
import { PennyRootLayout } from '@/core/app/root-layout'
import { coinFaviconLinks } from '@/core/ui/brand/coin'
import { fontLinks } from '@/base/font-head'

export const Route = createRootRoute({
  loader: () => loadEditorAdmission(),
  component: PennyRootLayout,
  head: () => ({ links: [...fontLinks, ...coinFaviconLinks], meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }, { title: publicLandingConfig.ownerName }] }),
  notFoundComponent: PennyNotFound,
})
