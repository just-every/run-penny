import { workspaceTimezone } from './workspace-zone'
import type { OperatorDecisionState, OperatorRoadmapStatus } from '@/core/shared/api/operator'

const dayOnly = /^\d{4}-\d{2}-\d{2}$/
const dayStyle = { day: 'numeric', month: 'short', year: 'numeric' } as const

/** The one short style on every operator screen: "7 Nov 2026" for a calendar day, "7 Nov 2026, 15:58" for a moment, which is
 * written in the workspace's time zone (or the zone given). A day with no time (a renewal) is never moved across zones. */
export function formatMoment(value: string | number, timeZone: string = workspaceTimezone()): string {
  const isDay = typeof value === 'string' && dayOnly.test(value)
  const date = new Date(isDay ? `${value}T00:00:00Z` : value)
  if (Number.isNaN(date.getTime())) return String(value)
  if (isDay) return new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', ...dayStyle }).format(date)

  return new Intl.DateTimeFormat('en-AU', { timeZone, ...dayStyle, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
}

/** A date with no time, such as a decision's review day or a snooze, in the workspace's time zone. */
export function formatDay(value: string, timeZone: string = workspaceTimezone()): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-AU', { timeZone, ...dayStyle }).format(date)
}

export function formatOperatorDate(value: string | null): string {
  return value ? formatMoment(value) : 'Not scheduled'
}

export const formatObservedAt = formatMoment

export function formatRevenue(value: number | null): string {
  if (value === null) return 'Not recorded'

  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value / 100)
}

export function decisionStateLabel(state: OperatorDecisionState): string {
  return ({
    draft: 'Draft',
    ready: 'Ready',
    committed: 'Committed',
    review_due: 'Review due',
  })[state]
}

export function roadmapStatusLabel(status: OperatorRoadmapStatus): string {
  return ({
    exploring: 'Exploring',
    planned: 'Planned',
    in_progress: 'In progress',
    shipped: 'Shipped',
    dropped: 'Dropped',
  })[status]
}

const sourceWords: Record<string, string> = { sales_call: 'Sales call', support_conversation: 'Support conversation', interview: 'Interview', email: 'Email', portal_request: 'Portal request' }
export function sourceLabel(sourceType: string, sourceLabel: string | null): string {
  if (sourceType === 'discord') return 'Discord'
  if (sourceType === 'free_text') return sourceLabel ?? 'Recorded note'

  return sourceWords[sourceType] ?? sourceType.replace(/_/g, ' ')
}
