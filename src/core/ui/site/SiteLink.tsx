import { useSiteVariant } from './SiteVariant'
import { useRouter } from '@tanstack/react-router'
import type { MouseEvent, ReactNode } from 'react'

type SiteLinkProps = { href: string; className?: string; current?: boolean; children: ReactNode }

/**
 * A link to one of this deployment's own pages. The server renders a plain anchor, so it works without script; after
 * hydration a plain left click navigates inside the app through the router's `href` option instead of reloading the
 * document. It takes a path rather than a typed route because the landing, the docs and the portal are separate features.
 * `current` marks the link as the section the page belongs to.
 */
export function SiteLink(props: SiteLinkProps) {
  return useSiteVariant() === 'site'
    ? <a href={props.href} className={props.className} aria-current={props.current ? 'true' : undefined}>{props.children}</a>
    : <InstanceSiteLink {...props} />
}

function InstanceSiteLink({ href, className, current = false, children }: SiteLinkProps) {
  const router = useRouter()
  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    void router.navigate({ href })
  }
  return <a href={href} className={className} aria-current={current ? 'true' : undefined} onClick={navigate}>{children}</a>
}
