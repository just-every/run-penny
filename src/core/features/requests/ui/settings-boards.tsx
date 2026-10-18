import { VoteImportanceSettings } from './vote-importance-settings'
import { CategorySettings } from '../../categories/category-settings'
import type { Category } from '../../categories/ui-types'
import {BoardSubscriptionSettings} from '../../settings/ui/board-subscription-settings'
import { useRef } from 'react'
import { Chip } from '@/core/ui/app/Chip'
import { fieldLabelClass, primaryButtonClass, textLinkClass } from '@/core/ui/app/classes'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { checkboxClass, checkRowClass } from './form-classes'
import { settingsPanelClass } from './settings-catalog'

export interface Board { id:string;category_mode:'off'|'optional'|'required';posting_policy:'requesters'|'operators';comments_allowed:number;show_vote_counts:number;show_voters:number;anonymous_requesters:number; slug: string; name: string; visibility: string; position: number; archived_at: string | null;vote_subscriptions:number;vote_subscription_version:number }
export type SettingsAct = (path: string, body: unknown, method?: string, form?: HTMLFormElement) => Promise<void>

const input = fieldClass
// The URL name follows the board name until the owner types one of their own.
const urlName = (name: string) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

export function BoardCard({ board: b, categories, act }: { board: Board; categories:readonly Category[]; act: SettingsAct }) {
  return (
    <div className={settingsPanelClass}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-base break-words text-penny-muted">URL name: {b.slug}{b.visibility === 'public' && !b.archived_at ? <> · <a href={`/portal/feedback?board=${encodeURIComponent(b.slug)}`} className={`${textLinkClass} inline-flex min-h-11 items-center`}>Open public board</a></> : null}</p>
        {b.archived_at ? <Chip tone="muted">Archived</Chip> : <Chip tone={b.visibility === 'public' ? 'sand' : 'neutral'}>{b.visibility === 'public' ? 'Public' : 'Internal'}</Chip>}
      </div>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); void act(`/api/operator/boards/${b.slug}`, { name: d.get('name'), visibility: d.get('visibility'), position: Number(d.get('position')), archived: d.get('archived') === 'on', categoryMode:d.get('categoryMode'), postingPolicy:d.get('postingPolicy'),commentsAllowed:d.get('commentsAllowed')==='on',showVoteCounts:d.get('showVoteCounts')==='on',showVoters:d.get('showVoters')==='on',anonymousRequesters:d.get('anonymousRequesters')==='on' }, 'PATCH') }}>
        <label className={fieldLabelClass}>Name<input name="name" required defaultValue={b.name} className={input} /></label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={fieldLabelClass}>Visibility<select name="visibility" defaultValue={b.visibility} className={input}><option value="public">Public</option><option value="internal">Internal</option></select></label>
          <label className={fieldLabelClass}>Order<input name="position" type="number" min={0} defaultValue={b.position} className={`${input} tabular-nums`} /></label>
        </div>
        <label className={fieldLabelClass}>Category on submission<select name="categoryMode" defaultValue={b.category_mode} className={input}><option value="off">Off</option><option value="optional">Optional</option><option value="required">Required</option></select></label>
        <label className={fieldLabelClass}>Who may post<select name="postingPolicy" defaultValue={b.posting_policy} className={input}><option value="requesters">Requesters and operators</option><option value="operators">Operators only</option></select></label>
        <label className={checkRowClass}><input name="commentsAllowed" type="checkbox" defaultChecked={!!b.comments_allowed} className={checkboxClass}/>Allow requester comments</label>
        <label className={checkRowClass}><input name="showVoteCounts" type="checkbox" defaultChecked={!!b.show_vote_counts} className={checkboxClass}/>Show vote totals publicly</label>
        <label className={checkRowClass}><input name="showVoters" type="checkbox" defaultChecked={!!b.show_voters} className={checkboxClass}/>List voter display names publicly</label>
        <label className={checkRowClass}><input name="anonymousRequesters" type="checkbox" defaultChecked={!!b.anonymous_requesters} className={checkboxClass}/>Show every requester as Anonymous</label>
        <label className={checkRowClass}><input name="archived" type="checkbox" defaultChecked={!!b.archived_at} className={checkboxClass} />Archive board</label>
        <button className={primaryButtonClass}>Save board</button>
      </form>
      <VoteImportanceSettings slug={b.slug}/>
      <CategorySettings boardSlug={b.slug} categories={categories.filter(c=>c.board_id===b.id)} act={act}/>
      <BoardSubscriptionSettings key={b.vote_subscription_version} slug={b.slug} enabled={Boolean(b.vote_subscriptions)} version={b.vote_subscription_version} act={act}/>
    </div>
  )
}

export function CreateBoardCard({ act }: { act: SettingsAct }) {
  const slug = useRef<HTMLInputElement>(null), typed = useRef(false)
  return (
    <div id="create-board" className={`${settingsPanelClass} scroll-mt-24 border-dashed`}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); typed.current = false; const d = new FormData(e.currentTarget); void act('/api/operator/boards', { name: d.get('name'), slug: d.get('slug'), visibility: d.get('visibility') }, 'POST', e.currentTarget) }}>
        <h3 className="text-lg font-bold text-penny-ink">Create board</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={fieldLabelClass}>Name<input name="name" required className={input} onChange={(e) => { if (!typed.current && slug.current) slug.current.value = urlName(e.target.value) }} /></label>
          <label className={fieldLabelClass}>URL name<input ref={slug} name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={input} onChange={(e) => { typed.current = e.target.value !== '' }} /></label>
        </div>
        <select aria-label="New board visibility" name="visibility" className={fieldClass}><option value="public">Public</option><option value="internal">Internal</option></select>
        <button className={primaryButtonClass}>Create board</button>
      </form>
    </div>
  )
}
