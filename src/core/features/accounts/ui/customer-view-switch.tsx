import { WorkspaceLink } from '@/core/features/workspace/ui/workspace-link'
import { primaryButtonClass, secondaryButtonClass } from '@/core/ui/app/classes'

const views = [{ key: 'accounts', href: '/app/accounts', label: 'Accounts' }, { key: 'requesters', href: '/app/requesters', label: 'Requesters' }] as const

/** The two customer lists, side by side under each list's heading; the open one is filled and marked as the current page. */
export function CustomerViewSwitch({ current }: { readonly current: (typeof views)[number]['key'] }) {
  return <nav aria-label="Customer context" className="mt-6 flex gap-3">{views.map((view) => <WorkspaceLink key={view.key} href={view.href} aria-current={view.key === current ? 'page' : undefined} className={view.key === current ? primaryButtonClass : secondaryButtonClass}>{view.label}</WorkspaceLink>)}</nav>
}
