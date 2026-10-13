import { Link } from '@tanstack/react-router'
import { primaryButtonClass } from '@/core/ui/app/classes'
import { EmptyArt } from '@/core/ui/app/collage/EmptyArt'
import { Icon } from '@/core/ui/app/Icon'
import { OperatorPageHeader } from './operator-page-header'
import { OperatorCard } from './operator-primitives'

export function OperatorWorkspaceNotFound() {
  return <><OperatorPageHeader eyebrow="Operator workspace" title="This operator page is not available.">Check the address or return to your workspace overview.</OperatorPageHeader><OperatorCard className="mt-8 px-5 py-8 text-center sm:py-10"><EmptyArt note="Nothing here." className="mx-auto mb-6 w-[280px] max-w-full sm:w-[360px]" /><Link to="/app/overview" className={primaryButtonClass}>Return to overview <Icon name="arrow" /></Link></OperatorCard></>
}
