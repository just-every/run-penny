import { Chip } from '@/core/ui/app/Chip'
import { disclosureSummaryClass } from '@/core/ui/app/classes'

export interface RequestVoter { id: string; displayName: string; votedAt: string; supporterType: 'proxy' | 'unmarked' | null }
const shown = 100

// Operator-only. Historical supporters keep their source's type: a proxy vote
// an admin entered stays visibly proxy and never becomes a person's own vote.
export function RequestSupporters({ voters }: { voters: readonly RequestVoter[] }) {
  const people = [...new Map(voters.map(voter => [voter.id, voter])).values()]
  if (!people.length) return null
  return <details className="group mt-5 border-t border-penny-line pt-1">
    <summary className={disclosureSummaryClass}>Supporters ({people.length})</summary>
    <ul className="mt-3 max-w-3xl divide-y divide-penny-line text-sm" aria-label="Supporters">
      {people.slice(0, shown).map(voter => <li key={voter.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
        <span className="min-w-0 break-words font-medium text-penny-ink">{voter.displayName}</span>
        <span className="flex flex-wrap items-center gap-2 text-penny-muted">
          <time dateTime={voter.votedAt} className="tabular-nums">{voter.votedAt.slice(0, 10)}</time>
          {voter.supporterType === 'proxy' ? <Chip tone="sand">Proxy, entered by a UserVoice admin</Chip> : voter.supporterType === 'unmarked' ? <Chip tone="muted">UserVoice, not marked as proxy</Chip> : null}
        </span>
      </li>)}
    </ul>
    {people.length > shown ? <p className="mt-2 text-sm text-penny-muted">Showing the first {shown} of {people.length} supporters.</p> : null}
    <p className="mt-2 text-sm leading-6 text-penny-muted">Imported supporters are historical attributions. They cannot sign in and are never contacted.</p>
  </details>
}
