import type { OperatorDecisionState, OperatorRoadmapStatus } from '@/core/shared/api/operator'

export function formatOperatorDate(value: string | null): string {
  if (!value) return 'Not scheduled'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  // Entered in the browser's local time; shown in UTC with its zone, so the day never silently shifts.
  return `${new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)} UTC`
}

export function formatObservedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  // Entered in the browser's local time; shown in UTC with its zone, so the day never silently shifts.
  return `${new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)} UTC`
}

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

export function sourceLabel(sourceType: string, sourceLabel: string | null): string {
  if (sourceType === 'free_text') return sourceLabel ?? 'Recorded note'

  return sourceType.replace(/_/g, ' ')
}
