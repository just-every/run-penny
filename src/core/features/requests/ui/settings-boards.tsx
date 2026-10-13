import { Chip } from '@/core/ui/app/Chip'
import { fieldLabelClass, primaryButtonClass, textLinkClass } from '@/core/ui/app/classes'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { checkboxClass, checkRowClass } from './form-classes'
import { settingsPanelClass } from './settings-catalog'

export interface Board { slug: string; name: string; visibility: string; position: number; archived_at: string | null }
export type SettingsAct = (path: string, body: unknown, method?: string, form?: HTMLFormElement) => Promise<void>

const input = fieldClass

export function BoardCard({ board: b, act }: { board: Board; act: SettingsAct }) {
  return (
    <div className={settingsPanelClass}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-base break-words text-penny-muted">URL name: {b.slug}{b.visibility === 'public' && !b.archived_at ? <> · <a href={`/portal/feedback?board=${encodeURIComponent(b.slug)}`} className={`${textLinkClass} inline-flex min-h-11 items-center`}>Open public board</a></> : null}</p>
        {b.archived_at ? <Chip tone="muted">Archived</Chip> : <Chip tone={b.visibility === 'public' ? 'sand' : 'neutral'}>{b.visibility === 'public' ? 'Public' : 'Internal'}</Chip>}
      </div>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); void act(`/api/operator/boards/${b.slug}`, { name: d.get('name'), visibility: d.get('visibility'), position: Number(d.get('position')), archived: d.get('archived') === 'on' }, 'PATCH') }}>
        <label className={fieldLabelClass}>Name<input name="name" required defaultValue={b.name} className={input} /></label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={fieldLabelClass}>Visibility<select name="visibility" defaultValue={b.visibility} className={input}><option value="public">Public</option><option value="internal">Internal</option></select></label>
          <label className={fieldLabelClass}>Order<input name="position" type="number" min={0} defaultValue={b.position} className={`${input} tabular-nums`} /></label>
        </div>
        <label className={checkRowClass}><input name="archived" type="checkbox" defaultChecked={!!b.archived_at} className={checkboxClass} />Archive board</label>
        <button className={primaryButtonClass}>Save board</button>
      </form>
    </div>
  )
}

export function CreateBoardCard({ act }: { act: SettingsAct }) {
  return (
    <div className={`${settingsPanelClass} border-dashed`}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); void act('/api/operator/boards', { name: d.get('name'), slug: d.get('slug'), visibility: d.get('visibility') }, 'POST', e.currentTarget) }}>
        <h3 className="text-lg font-bold text-penny-ink">Create board</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={fieldLabelClass}>Name<input name="name" required className={input} /></label>
          <label className={fieldLabelClass}>URL name<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={input} /></label>
        </div>
        <select aria-label="New board visibility" name="visibility" className={fieldClass}><option value="public">Public</option><option value="internal">Internal</option></select>
        <button className={primaryButtonClass}>Create board</button>
      </form>
    </div>
  )
}
