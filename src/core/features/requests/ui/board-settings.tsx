import {IntegrationDestinations} from '../../integrations/ui/destinations'
import {TrackerSettings} from '../../integrations/ui/tracker-settings'
import {BrandingSettings} from '../../settings/ui/branding-settings'
import { FrameSettings } from '../../settings/ui/frame-settings'
import { OperatorSettings } from '../../auth/ui/operator-settings'
import {ApiKeys} from '../../integrations/ui/api-keys'
import { OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { useState } from 'react'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import { operatorMutation } from './operator-client'
import { DeliveryReview } from './delivery-review'
import { BoardCard, CreateBoardCard, type Board } from './settings-boards'
import { CreateFieldCard, CreateTagCard, FieldList, SettingsSection, TagCard, type CustomField, type Tag } from './settings-catalog'

interface Settings { boards: Board[]; tags: Tag[]; fields: CustomField[] }

export function BoardSettings() {
  const [data, refresh] = usePublicResource<Settings>('/api/operator/catalog/settings'), [message, setMessage] = useState(''), [success, setSuccess] = useState(false)
  async function act(path: string, body: unknown, method = 'POST', form?: HTMLFormElement) {
    try { await operatorMutation(path, body, method); form?.reset(); setSuccess(true); setMessage('Saved.'); refresh() } catch (e) { setSuccess(false); setMessage(e instanceof Error ? e.message : 'Could not save.') }
  }
  const ready = data.kind === 'ready' ? data.data : null
  return (
    <section className="min-w-0">
      <OperatorPageHeader eyebrow="Customer feedback" title="Feedback settings" art={data.kind === 'error' ? null : { note: 'Better feedback builds better products.' }}>Requester submissions, edits and comments are reviewed before publication.</OperatorPageHeader>
      <div className="mt-6 space-y-6 sm:mt-8">
        <OperatorSettings />
        <DeliveryReview />
        <ApiKeys />
        <IntegrationDestinations />
        <TrackerSettings />
        <BrandingSettings />
        <FrameSettings />
        <SettingsSection id="settings-boards" icon="board" title="Boards">
          {data.kind !== 'ready' ? <p className="text-base text-penny-muted">Loading settings…</p> : null}
          {ready && ready.boards.length === 0 ? <p className="mb-4 text-base text-penny-muted">No boards yet</p> : null}
          <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {ready ? ready.boards.map((b) => <BoardCard key={b.slug} board={b} act={act} />) : null}
            <CreateBoardCard act={act} />
          </div>
        </SettingsSection>
        <SettingsSection id="settings-tags" icon="tag" title="Private tags">
          <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {ready ? ready.tags.map((t) => <TagCard key={t.id} tag={t} tags={ready.tags} act={act} />) : null}
            <CreateTagCard act={act} />
          </div>
        </SettingsSection>
        <SettingsSection id="settings-fields" icon="form" title="Private custom fields">
          {ready ? <FieldList fields={ready.fields} /> : null}
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2"><CreateFieldCard act={act} /></div>
        </SettingsSection>
      </div>
      <p role="status" className={`sticky bottom-4 z-10 mt-6 w-fit max-w-full rounded-lg border bg-penny-card px-4 py-2.5 text-sm font-bold shadow-[0_4px_14px_rgb(92_62_32_/_0.14)] empty:hidden ${success ? 'border-penny-moss/40 text-penny-moss' : 'border-penny-danger/40 text-penny-danger'}`}>{message}</p>
    </section>
  )
}
