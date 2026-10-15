import { HydrationUnit } from '@/base/hydration/unit'
import {HostIdentityBridge} from '@/core/features/auth/ui/host-identity-bridge'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {usePublicResource} from './public-resource'
import branding from '@/branding.json'
import { BrandRoot } from '@/core/ui/app/BrandRoot'
import { CoinMark } from '@/core/ui/brand/CoinMark'
import { CopperStroke } from '@/core/ui/brand/collage/Stroke'

export interface PublicPortalContent {
  readonly ownerName: string
  readonly portalDescription: string
  readonly showPoweredByCredit: boolean
}

const navLinkClass = 'relative inline-flex min-h-11 items-center text-penny-soft transition-colors hover:text-penny-ink aria-[current=page]:font-semibold aria-[current=page]:text-penny-ink'
const footerLinkClass = 'min-h-11 content-center text-penny-soft underline decoration-penny-line-strong underline-offset-4 transition-colors hover:text-penny-ink hover:decoration-penny-copper'

/** A portal section link; the current one is bold with the copper hand stroke under it. */
function PortalNavLink({ to, exact = false, children }: { readonly to: '/' | '/portal/roadmap' | '/portal/feedback/activity' | '/portal/updates'; readonly exact?: boolean; readonly children: string }) {
  return (
    <Link to={to} activeOptions={{ exact }} className={navLinkClass}>
      {({ isActive }) => <>{children}{isActive ? <CopperStroke className="absolute right-0 bottom-1.5 left-0 h-1.5 w-full" /> : null}</>}
    </Link>
  )
}

export function PublicPortalLayout({ content, children }: { readonly content: PublicPortalContent; readonly children: ReactNode }) {
  const [resource]=usePublicResource<{description:string;accent:string;showLogo:boolean}>('/api/public/branding')
  const appearance=resource.kind==='ready'?resource.data:{description:content.portalDescription,accent:branding.accent,showLogo:branding.logo==='penny-mark'}
  return (
    <BrandRoot className="public-portal flex min-h-svh flex-col" style={{'--penny-brand-accent':appearance.accent} as CSSProperties}>
      <a href="#public-content" className="sr-only z-50 rounded-full bg-penny-ink px-4 py-3 text-sm font-semibold text-penny-paper focus:not-sr-only focus:absolute focus:left-4 focus:top-4">Skip to content</a>
      <HydrationUnit><header>
        <div className="mx-auto flex min-h-18 max-w-[1240px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 pt-3 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex min-w-0 min-h-11 items-center gap-2.5 text-lg font-semibold tracking-[-0.025em] text-penny-ink" aria-label={`${content.ownerName} feedback portal`}>
            {appearance.showLogo ? <CoinMark className="shrink-0 [--coin-slot:2rem]" /> : null}
            <span data-rer-name className="break-words">{content.ownerName}</span>
          </Link>
          <nav className="flex min-h-11 max-w-full flex-wrap items-center gap-x-3 gap-y-0 text-sm font-medium sm:gap-x-6 sm:text-[15px]" aria-label="Public portal">
            <PortalNavLink to="/" exact>Feedback</PortalNavLink>
            <PortalNavLink to="/portal/roadmap">Roadmap</PortalNavLink>
            <PortalNavLink to="/portal/feedback/activity">Your feedback</PortalNavLink>
            <PortalNavLink to="/portal/updates">Updates</PortalNavLink>
            <Link to="/signin" className={navLinkClass}>Sign in</Link>
          </nav>
        </div>
      </header></HydrationUnit>
      <HostIdentityBridge />
      {resource.kind==='error'?<p role="alert" className="px-4 py-3">Portal appearance settings could not be loaded. Reload to try again.</p>:null}
      <main id="public-content" className="mx-auto min-w-0 flex-1 w-full max-w-[1240px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">{children}</main>
      <HydrationUnit><footer className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-18 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-penny-line py-4 text-xs font-medium text-penny-muted">
          <p className="min-w-0 break-words">{appearance.description}</p>
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {content.showPoweredByCredit ? <><span>Powered by {content.ownerName}</span><span aria-hidden="true">·</span><a href="https://runeditrun.com" className={footerLinkClass}>runeditrun.com</a></> : null}
            {content.showPoweredByCredit ? <span aria-hidden="true">·</span> : null}
            <Link to="/signin" className={footerLinkClass}>Operator sign in</Link>
          </p>
        </div>
      </footer></HydrationUnit>
    </BrandRoot>
  )
}
