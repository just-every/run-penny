import { CustomFieldsEditor } from '@/core/features/settings/ui/custom-fields-editor'
import { EvidenceHistory } from './evidence-history'
import { EvidenceActions } from './evidence-actions'
import { TagEditor, evidenceTagApi } from '@/core/features/catalog/ui/tag-editor'
import type { OperatorEvidenceCard } from '@/core/shared/api/operator'
import { formatObservedAt, sourceLabel } from '@/core/app/ui/operator-format'
import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { Icon } from '@/core/ui/app/Icon'
import { Chip } from '@/core/ui/app/Chip'
import { DataField, dataRowClass } from '@/core/ui/app/DataField'

export function EvidenceCard({ evidence, onSaved }: { readonly evidence: OperatorEvidenceCard; readonly onSaved?: () => void }) {
  return (
    <OperatorCard id={`evidence-${evidence.id}`} className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Chip tone={evidence.reviewState === 'unreviewed' ? 'copper' : 'moss'}>{evidence.reviewState === 'unreviewed' ? 'Unreviewed' : 'Reviewed'}</Chip>
        <time className="text-sm text-penny-ink tabular-nums sm:text-base" dateTime={evidence.observedAt}>{formatObservedAt(evidence.observedAt)}</time>
      </div>
      <p className="mt-4 text-lg leading-snug font-medium break-words whitespace-pre-wrap text-penny-ink sm:text-[22px]">“{evidence.wording}”</p>
      <dl className={`mt-5 border-t border-penny-line pt-4 ${dataRowClass}`}>
        <DataField label="Source">{sourceLabel(evidence.sourceType, evidence.sourceLabel)}</DataField>
        <DataField label="Account">{evidence.account?.name}</DataField>
      </dl>
      {evidence.requester ? <dl className="mt-4"><DataField label="Requester" valueClassName="flex flex-wrap items-center gap-x-2 gap-y-1"><span>{evidence.requester.displayName}</span>{evidence.requester.email ? <span className="break-all text-penny-muted">{evidence.requester.email}</span> : null}</DataField></dl> : null}
      {evidence.namedSpeaker ? <p className="mt-3 text-base text-penny-ink">Named speaker: {evidence.namedSpeaker}</p> : null}
      {onSaved ? <div className="mt-4"><TagEditor label="Evidence tags" tagNames={evidence.tags} onChanged={onSaved} {...evidenceTagApi(evidence.id)} /></div> : evidence.tags.length > 0 ? <ul className="mt-4 flex list-none flex-wrap gap-2 p-0" aria-label="Evidence tags">{evidence.tags.map((tag) => <li key={tag}><Chip tone="sand">{tag}</Chip></li>)}</ul> : null}
      {evidence.reviewReason ? <p className="mt-4 flex gap-2 border-t border-penny-line pt-4 text-base leading-normal text-penny-muted"><Icon name="check" className="mt-1 size-4 shrink-0 text-penny-moss" />{evidence.reviewReason}</p> : null}
      <CustomFieldsEditor entityType="evidence" entityId={evidence.id} />
      {onSaved ? <><EvidenceActions evidence={evidence} onSaved={onSaved} /><EvidenceHistory id={evidence.id} onSaved={onSaved} /></> : null}
    </OperatorCard>
  )
}
