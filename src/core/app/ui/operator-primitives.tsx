import type { ComponentProps, ReactNode } from 'react'
import type { OperatorDecisionState, OperatorRoadmapStatus } from '@/core/shared/api/operator'
import { Chip, type ChipTone } from '@/core/ui/app/Chip'
import { paperCardClass } from '@/core/ui/app/classes'
import { decisionStateLabel, roadmapStatusLabel } from './operator-format'

export function OperatorCard({ children, className = '', as: Element = 'section', ...props }: { readonly children: ReactNode; readonly className?: string; readonly as?: 'section' | 'article' } & Omit<ComponentProps<'section'>, 'children' | 'className'>) {
  return <Element {...props} className={`${paperCardClass} ${className}`}>{children}</Element>
}

const decisionTones: Record<OperatorDecisionState, ChipTone> = {
  draft: 'neutral',
  ready: 'copper-outline',
  committed: 'moss',
  review_due: 'copper',
}

export function OperatorDecisionState({ state }: { readonly state: OperatorDecisionState }) {
  return <Chip tone={decisionTones[state]}>{decisionStateLabel(state)}</Chip>
}

const roadmapTones: Record<OperatorRoadmapStatus, ChipTone> = {
  exploring: 'sand',
  planned: 'copper-outline',
  in_progress: 'copper',
  shipped: 'moss',
  dropped: 'muted',
}

export function OperatorRoadmapStatus({ status }: { readonly status: OperatorRoadmapStatus }) {
  return <Chip tone={roadmapTones[status]}>{roadmapStatusLabel(status)}</Chip>
}

export function OperatorReleaseState({ state }: { readonly state: 'draft' | 'published' }) {
  return <Chip tone={state === 'published' ? 'moss' : 'neutral'}>{state === 'published' ? 'Published' : 'Draft'}</Chip>
}
