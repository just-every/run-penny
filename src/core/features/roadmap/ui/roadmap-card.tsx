import { CustomFieldsEditor } from '@/core/features/settings/ui/custom-fields-editor'
import type { ReactNode } from 'react'
import { RoadmapActions } from './roadmap-actions'
import type { OperatorRoadmapCard } from '@/core/shared/api/operator'
import { OperatorCard, OperatorDecisionState, OperatorRoadmapStatus } from '@/core/app/ui/operator-primitives'
import { Chip } from '@/core/ui/app/Chip'
import { dataLabelClass, disclosureSummaryClass } from '@/core/ui/app/classes'
import { DataField } from '@/core/ui/app/DataField'

function Row({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3"><dt className={dataLabelClass}>{label}</dt><dd className="text-right text-sm font-semibold text-penny-ink tabular-nums">{children}</dd></div>
}

export function RoadmapCard({ item, onSaved }: { readonly item: OperatorRoadmapCard; onSaved: () => void }) {
  return (
    <OperatorCard id={`roadmap-item-${item.id}`} className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <OperatorRoadmapStatus status={item.status} />
        <span className="text-xs font-semibold text-penny-muted">{item.publicStatus ? `Public: ${item.publicStatus.replace(/_/g, ' ')}` : 'Internal only'}</span>
      </div>
      <h3 className="mt-3 font-bold tracking-[-0.01em] text-penny-ink">{item.title}</h3>
      <p className="mt-1 text-sm leading-6 text-penny-muted">{item.summary}</p>
      <dl className="mt-4 space-y-2 border-t border-penny-line pt-3">
        <Row label="Owner">{item.owner?.displayName ?? 'No owner'}</Row>
        <Row label="Target">{item.targetWindow ?? 'Not scheduled'}</Row>
        <Row label="Evidence">{item.evidenceCount}</Row>
        {item.decision ? (
          <DataField label="Decision" className="pt-1" valueClassName="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className="max-w-full min-w-0 [overflow-wrap:anywhere]">{item.decision.title}</span>
            {item.decisionDisposition === 'declined' ? <Chip tone="muted">Declined</Chip> : <OperatorDecisionState state={item.decision.state} />}
          </DataField>
        ) : null}
      </dl>
      <CustomFieldsEditor entityType="roadmapItem" entityId={item.id} />
      <details className="group mt-3 border-t border-penny-line pt-1">
        <summary className={disclosureSummaryClass}>Edit, approve or move</summary>
        <RoadmapActions item={item} onSaved={onSaved} />
      </details>
    </OperatorCard>
  )
}
