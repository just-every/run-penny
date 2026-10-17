import {WorkspaceClockSettings} from '../../settings/ui/workspace-clock-settings'
import {useRouter} from '@tanstack/react-router'
import type { Category } from '../../categories/ui-types'
import {MailIdentitySettings} from '../../settings/ui/mail-identity-settings'
import {StatusRoadmapSettings} from '../../roadmap/ui/status-roadmap-settings'
import {RequestStatusSettings} from '../../settings/ui/request-status-settings'
import {IntegrationDestinations} from '../../integrations/ui/destinations'
import {TrackerSettings} from '../../integrations/ui/tracker-settings'
import {BrandingSettings} from '../../settings/ui/branding-settings'
import { FrameSettings } from '../../settings/ui/frame-settings'
import { OperatorSettings } from '../../auth/ui/operator-settings'
import { TestCustomers } from '../../auth/ui/test-customers'
import {ApiKeys} from '../../integrations/ui/api-keys'
import { OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { useRef, useState } from 'react'
import { useSettingsAnchor } from './settings-anchor'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import { CustomFieldSettings } from '@/core/features/settings/ui/custom-field-settings'
import { operatorMutation } from './operator-client'
import { DeliveryReview } from './delivery-review'
import { BoardCard, CreateBoardCard, type Board } from './settings-boards'
import { CreateTagCard, SettingsSection, TagCard, type Tag } from './settings-catalog'

interface Settings { categories:Category[]; boards: Board[]; tags: Tag[] }

export function BoardSettings() {
  const router=useRouter()
  const [data, refresh] = usePublicResource<Settings>('/api/operator/catalog/settings'), [message, setMessage] = useState(''), [success, setSuccess] = useState(false)
  async function act(path: string, body: unknown, method = 'POST', form?: HTMLFormElement) {
    try { await operatorMutation(path, body, method); form?.reset(); setSuccess(true); setMessage('Saved.'); refresh(); await router.invalidate() } catch (e) { setSuccess(false); setMessage(e instanceof Error ? e.message : 'Could not save.') }
  }
  const section = useRef<HTMLElement>(null)
  useSettingsAnchor(section)
  const ready = data.kind === 'ready' ? data.data : null
  return (
    <section ref={section} className="min-w-0">
      <OperatorPageHeader eyebrow="Customer feedback" title="Feedback settings" art={data.kind === 'error' ? null : { note: 'Better feedback builds better products.' }}>Requester submissions, edits and comments are reviewed before publication.</OperatorPageHeader>
      <div className="mt-6 space-y-6 sm:mt-8">
        <OperatorSettings />
        <TestCustomers />
        <DeliveryReview />
        <ApiKeys />
        <IntegrationDestinations />
        <TrackerSettings />
        <MailIdentitySettings />
        <WorkspaceClockSettings />
        <BrandingSettings />
        <FrameSettings />
        <RequestStatusSettings />
        <StatusRoadmapSettings />
        <SettingsSection id="settings-boards" icon="board" title="Boards">
          {data.kind !== 'ready' ? <p className="text-base text-penny-muted">Loading settings…</p> : null}
          {ready && ready.boards.length === 0 ? <p className="mb-4 text-base text-penny-muted">No boards yet</p> : null}
          <p className="mb-4 text-sm"><a className="inline-flex min-h-11 items-center text-penny-ink underline underline-offset-4" href="/api/operator/requests/export.csv">Export requests with categories (CSV)</a></p>
          <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {ready ? ready.boards.map((b) => <BoardCard key={b.slug} board={b} categories={ready.categories} act={act} />) : null}
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
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2"><div className="lg:col-span-2"><CustomFieldSettings embedded /></div></div>
        </SettingsSection>
      </div>
      <p role="status" className={`sticky bottom-4 z-10 mt-6 w-fit max-w-full rounded-lg border bg-penny-card px-4 py-2.5 text-sm font-bold shadow-[0_4px_14px_rgb(92_62_32_/_0.14)] empty:hidden ${success ? 'border-penny-moss/40 text-penny-moss' : 'border-penny-danger/40 text-penny-danger'}`}>{message}</p>
    </section>
  )
}
