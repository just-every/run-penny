import { introGuardScript, introCss } from '@/base/hydration/intro-guard'
import { HydrationUnit } from '@/base/hydration/unit'
import {PennyEditor,useEditorLeafReady} from '@/core/features/editor/client'
import { HeadContent, Outlet, Scripts, useLoaderData, useLocation } from '@tanstack/react-router'
import { BrandRoot } from '@/core/ui/app/BrandRoot'
import { EmptyArt } from '@/core/ui/app/collage/EmptyArt'
import { Wordmark } from '@/core/ui/app/Wordmark'
import { publicLandingConfig } from './extension-config'
import type { CSSProperties } from 'react'
import branding from '@/branding.json'
import '../../index.css'
import '@/core/ui/brand/styles'

export function PennyRootLayout() {
  const authorized=useLoaderData({from:'__root__'})
  return <html lang="en" style={{ '--penny-brand-accent': branding.accent } as CSSProperties}><head><script dangerouslySetInnerHTML={{ __html: introGuardScript }} /><style>{introCss}</style><HeadContent /></head><body><Outlet /><HydrationUnit><PennyEditor authorized={authorized} /></HydrationUnit><Scripts /></body></html>
}

export function PennyNotFound() {
  useEditorLeafReady(useLocation({select:location=>location.pathname}))
  return (
    <BrandRoot>
      <main className="grid min-h-svh place-items-center px-4 py-12 text-center sm:px-6">
        <div className="max-w-xl">
          <p><Wordmark name={publicLandingConfig.ownerName} /></p>
          <EmptyArt note="Nothing here." className="mx-auto mt-10 w-[280px] max-w-full sm:w-[360px]" />
          <h1 className="mt-4 text-[34px] leading-[1.02] font-extrabold text-balance text-penny-ink sm:text-[42px]">That page does not exist.</h1>
        </div>
      </main>
    </BrandRoot>
  )
}
