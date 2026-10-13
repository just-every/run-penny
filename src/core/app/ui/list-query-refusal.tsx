import { ErrorComponent, useLocation, type ErrorComponentProps } from '@tanstack/react-router'
import { primaryButtonClass } from '@/core/ui/app/classes'
import { Icon } from '@/core/ui/app/Icon'
import { invalidListQuery } from '@/core/features/workspace/list-query'
import { WorkspaceLink } from '@/core/features/workspace/ui/workspace-link'
import { OperatorPageHeader } from './operator-page-header'
import { OperatorCard } from './operator-primitives'

/** A list page's error boundary. A filter or page the list does not have (a stale bookmark or an edited address) gets a
 * way back to the plain list; the worker answers that document as 400. Any other failure keeps the router's own error. */
export function ListQueryRefusal(props: ErrorComponentProps) {
  const location = useLocation()
  if (!invalidListQuery(location.search)) return <ErrorComponent {...props} />
  return <><OperatorPageHeader eyebrow="Operator workspace" title="This filter is not valid.">The address asks for a filter or page this list does not have.</OperatorPageHeader><OperatorCard className="mt-8 px-5 py-8 text-center sm:py-10"><WorkspaceLink href={location.pathname} className={primaryButtonClass}>Clear filters <Icon name="arrow" /></WorkspaceLink></OperatorCard></>
}
