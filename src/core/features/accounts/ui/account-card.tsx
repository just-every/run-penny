import { Link } from '@tanstack/react-router'
import type { OperatorAccountCard } from '@/core/shared/api/operator'
import { formatOperatorDate, formatRevenue } from '@/core/app/ui/operator-format'
import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { Icon } from '@/core/ui/app/Icon'
import { DataField } from '@/core/ui/app/DataField'

export function AccountCard({ account }: { readonly account: OperatorAccountCard }) {
  return <Link to="/app/accounts/$accountSlug" params={{ accountSlug: account.slug }} className="block min-w-0 rounded-xl"><OperatorCard className="h-full p-5 transition-colors hover:border-penny-line-strong"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 className="break-words text-xl font-bold tracking-[-0.02em] text-penny-ink">{account.name}</h2><p className="mt-1 break-words text-sm text-penny-muted">{account.health ?? 'No health context recorded'}</p></div><Icon name="arrow" className="mt-1.5 shrink-0 text-penny-ink" /></div><dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-penny-line pt-4 text-sm"><DataField label="Commercial context" valueClassName="font-semibold tabular-nums">{formatRevenue(account.revenueCents)}</DataField><DataField label="Renewal" valueClassName="font-semibold tabular-nums">{formatOperatorDate(account.renewalDate)}</DataField><DataField label="Requesters" valueClassName="font-semibold tabular-nums">{account.requesterCount}</DataField><DataField label="Evidence" valueClassName="font-semibold tabular-nums">{account.evidenceCount}</DataField></dl><p className="mt-4 border-t border-penny-line pt-3 text-sm text-penny-muted">Owner: <span className="font-semibold text-penny-ink">{account.owner?.displayName ?? 'Not assigned'}</span></p></OperatorCard></Link>
}
