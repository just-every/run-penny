import {PostalAddressPrompt} from '@/core/features/settings/ui/postal-address-prompt'
import { ReviewNotifications } from '@/core/features/notifications/ui/review-notifications'
import { useState } from 'react'
import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { publicLandingConfig } from '@/core/app/extension-config'
import { BrandRoot } from '@/core/ui/app/BrandRoot'
import { Wordmark } from '@/core/ui/app/Wordmark'
import { postJson } from '@/core/features/auth/client-mutations'
import { Icon } from '@/core/ui/app/Icon'

const navigation = [
  { to: '/app/overview', label: 'Overview', icon: 'overview' },
  { to: '/app/learning', label: 'Learning', icon: 'evidence' },
  { to: '/app/feedback', label: 'Feedback', icon: 'feedback' },
  { to: '/app/moderation', label: 'Moderation', icon: 'moderation' },
  { to: '/app/decisions', label: 'Decisions', icon: 'decisions' },
  { to: '/app/roadmap', label: 'Roadmap', icon: 'roadmap' },
  { to: '/app/releases', label: 'Releases', icon: 'releases' },
  { to: '/app/customers', label: 'Accounts', icon: 'accounts' },
  { to: '/app/search', label: 'Search', icon: 'search' },
  { to: '/app/settings', label: 'Feedback settings', icon: 'settings' },
  { to: '/app/data', label: 'Data', icon: 'data' },
] as const

const itemClass = 'relative flex min-h-11 items-center gap-3.5 rounded-lg px-3 text-base transition-colors lg:text-[17px]'
// The current item: a soft copper fill with a copper bar at its left edge, its label and icon in the dark accent (5.8:1 on
// that fill, where the copper text tone would fall under 4.5:1).
const currentClass = 'bg-penny-copper/12 font-semibold text-penny-accent-dark before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-penny-copper'
const restClass = 'font-[450] text-penny-soft hover:bg-penny-ink/5 hover:text-penny-ink'
const sidebarSurface = 'border-r border-penny-line bg-[color-mix(in_srgb,var(--color-penny-sand)_45%,var(--color-penny-paper))]'

function activeDestination(pathname: string): string {
  if (pathname.startsWith('/app/decisions')) return '/app/decisions'
  if (pathname.startsWith('/app/releases')) return '/app/releases'
  if (pathname.startsWith('/app/customers')) return '/app/customers'
  return pathname
}

async function signOut() {
  try { await postJson('/api/auth/sign-out', {}); location.assign('/signin') } catch { alert('Sign-out failed. Please retry.') }
}

function NavigationLinks({ onNavigate }: { readonly onNavigate?: () => void }) {
  const location = useLocation()
  const active = activeDestination(location.pathname)

  return (
    <nav className="grid gap-1" aria-label="Operator workspace">
      {navigation.map((item) => {
        const isActive = active === item.to
        return <Link key={item.to} to={item.to} onClick={onNavigate} className={`${itemClass} ${isActive ? currentClass : restClass}`} aria-current={isActive ? 'page' : undefined}><Icon name={item.icon} className="size-[22px] shrink-0" />{item.label}</Link>
      })}
    </nav>
  )
}

function SignOutButton({ className, icon = false }: { readonly className: string; readonly icon?: boolean }) {
  return <button type="button" className={className} onClick={signOut}>{icon ? <Icon name="signout" className="size-[22px] shrink-0" /> : null}Sign out</button>
}

function Brand({ small = false }: { readonly small?: boolean }) {
  return <Link to="/app/overview" className="inline-flex min-h-11 items-center rounded-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-penny-accent"><Wordmark name={publicLandingConfig.ownerName} small={small} /></Link>
}

export function OperatorAppShell() {
  const [isMenuOpen, setMenuOpen] = useState(false)

  return (
    <BrandRoot className="penny-workspace relative">
      <a href="#operator-content" className="sr-only z-50 rounded-full bg-penny-ink px-4 py-3 text-sm font-semibold text-penny-paper focus:not-sr-only focus:absolute focus:left-4 focus:top-4">Skip to content</a>
      <div aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-0 z-0 hidden w-60 ${sidebarSurface} lg:block`} />
      <aside className={`fixed left-0 top-0 z-20 hidden h-svh w-60 flex-col overflow-y-auto overscroll-y-contain ${sidebarSurface} px-3 py-5 lg:flex`}>
        <div className="px-2"><Brand /></div>
        <p className="mt-10 px-3 text-[11px] font-semibold tracking-[0.12em] text-penny-muted uppercase">Operator workspace</p>
        <div className="mt-3 shrink-0"><NavigationLinks /></div>
        <div className="mt-4 shrink-0 border-t border-penny-line pt-3"><SignOutButton icon className={`${itemClass} ${restClass} w-full text-left`} /></div>
        <p className="mt-auto shrink-0 px-3 pt-6 text-xs leading-5 text-penny-muted">Customer evidence, accountable decisions, and release outcomes.</p>
      </aside>
      <header className="sticky top-0 z-20 border-b border-penny-line bg-penny-paper/95 backdrop-blur lg:hidden">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <Brand small />
          <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
            <SignOutButton className="inline-flex min-h-11 items-center rounded-full px-2 text-base text-penny-soft transition-colors hover:text-penny-ink sm:px-3" />
            <details className="relative" open={isMenuOpen} onToggle={(event) => setMenuOpen(event.currentTarget.open)}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-penny-ink px-4 text-base font-medium text-penny-ink transition-colors hover:bg-penny-ink/6 [&::-webkit-details-marker]:hidden"><Icon name="menu" className="size-5" />Menu</summary>
              <div className="absolute right-0 top-[calc(100%+0.5rem)] w-60 rounded-xl border border-penny-line bg-penny-card p-2 shadow-[0_12px_32px_rgb(92_62_32_/_0.14)]"><NavigationLinks onNavigate={() => setMenuOpen(false)} /></div>
            </details>
          </div>
        </div>
      </header>
      <main id="operator-content" className="mx-auto w-full max-w-[1600px] px-4 pt-6 pb-12 sm:px-6 sm:pt-9 lg:ml-60 lg:w-[calc(100%_-_15rem)] lg:px-12 lg:pt-10"><ReviewNotifications/><PostalAddressPrompt/><Outlet /></main>
    </BrandRoot>
  )
}
