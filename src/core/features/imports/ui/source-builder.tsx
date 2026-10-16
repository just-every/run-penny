import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { fieldClass } from '../../auth/client-mutations'
import { fieldLabelClass, fileInputClass, textLinkClass } from '@/core/ui/app/classes'
import type { FeedbackStatus, SavedFeedbackInput } from '../types'
import { buildBundle, cannyCheck, guessIdeaClass, guessIdeaColumns, guessStatus, ideasCheck, pennyStatuses, readCsv, sourceStatuses, sourceTagCells, statusColumn, uservoiceCheck, uservoicePrivateColumns, type ExportKind, type IdeaClass, type IdeaColumn, type SavedCsv } from './source-model'

const kinds: { id: ExportKind; label: string; how: ReactNode }[] = [
  { id: 'canny', label: 'Canny post export (CSV)', how: <>In Canny: Settings → Boards → <strong>Export Data</strong>, or the download button on a filtered Feedback page.</> },
  { id: 'canny-ideas', label: 'Canny Ideas view export (CSV)', how: <>In Canny’s Ideas dashboard: right-click a view in the sidebar → <strong>Export view</strong>.</> },
  { id: 'uservoice', label: 'UserVoice ideas export (CSV)', how: <>In UserVoice’s idea grid: <strong>Export</strong> → Export Current Dataset → <strong>Ideas</strong>, as CSV. Add the <strong>Idea &amp; Voters</strong> export from the same view to bring supporters too.</> },
  { id: 'bundle', label: 'A bundle prepared with the command line', how: <>For saved Canny API files. See <a className={textLinkClass} href="https://github.com/just-every/run-penny/blob/main/docs/MOVE-IN.md" target="_blank" rel="noopener noreferrer">Move saved feedback in</a>.</> },
]
const roles: { id: IdeaColumn; label: string }[] = [{ id: 'key', label: 'Idea ID or URL' }, { id: 'title', label: 'Title' }, { id: 'details', label: 'Description' }, { id: 'status', label: 'Status' }, { id: 'created', label: 'Created date' }, { id: 'author', label: 'Author (optional)' }]
const classLabels: Record<IdeaClass, string> = { private: 'Keep private, not mapped', count: 'Count', company: 'Company names', revenue: 'Revenue' }
const defaultBoard: Record<ExportKind, string> = { canny: 'Imported from Canny', 'canny-ideas': 'Imported from Canny', uservoice: 'Imported from UserVoice', bundle: 'Imported from Canny' }
const statusLabel = (status: string) => status.replaceAll('_', ' ')

/** Turns an ordinary Canny or UserVoice export into the import bundle on this page. */
export function SourceBuilder({ disabled, onSource }: { disabled: boolean; onSource: (source: SavedFeedbackInput | null) => void }) {
  const [kind, setKind] = useState<ExportKind>('canny'), [main, setMain] = useState<SavedCsv | null>(null), [voters, setVoters] = useState<SavedCsv | null>(null)
  const [bundle, setBundle] = useState<SavedFeedbackInput | null>(null), [error, setError] = useState('')
  const [boardName, setBoardName] = useState(defaultBoard.canny), [isPrivate, setPrivate] = useState(true), [scope, setScope] = useState<'complete' | 'filtered'>('complete'), [filter, setFilter] = useState('')
  const [statusChoice, setStatusChoice] = useState<Record<string, FeedbackStatus>>({}), [tagChoice, setTagChoice] = useState<Record<string, string>>({})
  const [columnChoice, setColumnChoice] = useState<Partial<Record<IdeaColumn, string>>>({}), [classChoice, setClassChoice] = useState<Record<string, IdeaClass>>({})
  const columns = useMemo(() => ({ ...(main && kind === 'canny-ideas' ? guessIdeaColumns(main.headings) : {}), ...columnChoice }), [main, kind, columnChoice])
  const statusValues = sourceStatuses(main, statusColumn(kind, { columns }))
  const statuses = Object.fromEntries(statusValues.map(value => [value, statusChoice[value] ?? guessStatus(value)]))
  const tags = Object.fromEntries(sourceTagCells(kind === 'canny' ? main : null).map(cell => [cell, tagChoice[cell] ?? cell]))
  const unmapped = main && kind === 'canny-ideas' ? main.headings.filter(heading => !Object.values(columns).includes(heading)) : []
  const classes = Object.fromEntries(unmapped.map(heading => [heading, classChoice[heading] ?? guessIdeaClass(main!, heading)]))
  const problem = !main ? null : kind === 'canny' ? cannyCheck(main) : kind === 'uservoice' ? uservoiceCheck(main, false) ?? (voters && uservoiceCheck(voters, true)) : kind === 'canny-ideas' ? ideasCheck({ columns }) : null
  // One bundle per set of choices: it is the exact source a preview and its apply share.
  const choicesKey = JSON.stringify({ boardName, isPrivate, statuses, tags, scope, filter, columns, classes })
  const source = useMemo(() => {
    if (kind === 'bundle') return bundle
    const choices = JSON.parse(choicesKey) as Parameters<typeof buildBundle>[3]
    if (!main || problem || !choices.boardName.trim() || kind === 'uservoice' && choices.scope === 'filtered' && !choices.filter.trim()) return null
    return buildBundle(kind, main, kind === 'uservoice' ? voters : null, choices)
  }, [kind, bundle, main, voters, problem, choicesKey])
  useEffect(() => { onSource(source) }, [source, onSource])

  const choose = (setter: (csv: SavedCsv | null) => void, file: File | undefined) => {
    setError(''); setter(null)
    if (file) void readCsv(file).then(setter, (reason: unknown) => setError(reason instanceof Error ? reason.message : 'The file could not be read.'))
  }
  const reset = (next: ExportKind) => { setKind(next); setMain(null); setVoters(null); setBundle(null); setError(''); setStatusChoice({}); setTagChoice({}); setColumnChoice({}); setClassChoice({}); if (Object.values(defaultBoard).includes(boardName)) setBoardName(defaultBoard[next]) }
  const file = (label: string, onFile: (file: File | undefined) => void, accept = '.csv,text/csv', required = true) => <label className={fieldLabelClass}>{label}<input className={`${fieldClass} ${fileInputClass}`} type="file" accept={accept} required={required} disabled={disabled} onChange={event => onFile(event.currentTarget.files?.[0])}/></label>
  const current = kinds.find(item => item.id === kind)!

  return <div className="space-y-5">
    <label className={fieldLabelClass}>What did you export?<select className={fieldClass} value={kind} disabled={disabled} onChange={event => reset(event.target.value as ExportKind)}>{kinds.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <p className="text-sm leading-6 text-penny-muted">{current.how}</p>
    {kind === 'bundle' ? file('Prepared saved feedback bundle', chosen => { setError(''); setBundle(null); if (chosen) void chosen.text().then(text => setBundle(JSON.parse(text) as SavedFeedbackInput)).catch(() => setError('The saved bundle is not valid JSON.')) }, 'application/json,.json')
      : <>{file(kind === 'uservoice' ? 'Ideas export file' : 'Export file', chosen => choose(setMain, chosen))}{kind === 'uservoice' ? file('Idea & Voters export file (optional)', chosen => choose(setVoters, chosen), '.csv,text/csv', false) : null}</>}
    {error || problem ? <p role="alert" className="text-sm leading-6 font-semibold text-penny-danger">{error || problem}</p> : null}
    {main && kind !== 'bundle' ? <div className="space-y-5 border-t border-penny-line pt-5">
      <p className="text-sm text-penny-ink">{main.rows.length} {main.rows.length === 1 ? 'row' : 'rows'} read from {main.name}{voters ? ` and ${voters.rows.length} from ${voters.name}` : ''}. Nothing is saved until you preview and apply.</p>
      {kind === 'canny-ideas' ? <fieldset className="space-y-3"><legend className={fieldLabelClass}>Which column holds each part of an idea?</legend><div className="grid gap-4 sm:grid-cols-2">{roles.map(role => <label key={role.id} className={fieldLabelClass}>{role.label}<select className={fieldClass} value={columns[role.id] ?? ''} disabled={disabled} onChange={event => setColumnChoice(previous => ({ ...previous, [role.id]: event.target.value || undefined }))}><option value="">{role.id === 'author' ? 'No author column' : 'Choose a column'}</option>{main.headings.map(heading => <option key={heading} value={heading}>{heading}</option>)}</select></label>)}</div>
        {unmapped.length ? <><p className="text-sm text-penny-muted">Other columns stay in Penny’s private copy of the file. Mark totals as counts or revenue to see them in the preview.</p><div className="grid gap-4 sm:grid-cols-2">{unmapped.map(heading => <label key={heading} className={fieldLabelClass}>{heading}<select className={fieldClass} value={classes[heading]} disabled={disabled} onChange={event => setClassChoice(previous => ({ ...previous, [heading]: event.target.value as IdeaClass }))}>{Object.entries(classLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>)}</div></> : null}
      </fieldset> : null}
      <div className="grid gap-4 sm:grid-cols-2"><label className={fieldLabelClass}>Penny board for these ideas<input className={fieldClass} value={boardName} required maxLength={80} disabled={disabled} onChange={event => setBoardName(event.target.value)}/></label><label className="flex min-h-11 items-center gap-3 self-end text-sm text-penny-ink"><input type="checkbox" className="size-4" checked={isPrivate} disabled={disabled} onChange={event => setPrivate(event.target.checked)}/>Private board (only operators see it)</label></div>
      {statusValues.length ? <fieldset className="space-y-3"><legend className={fieldLabelClass}>Match each status to Penny’s</legend><div className="grid gap-4 sm:grid-cols-2">{statusValues.map(value => <label key={value} className={fieldLabelClass}>{value || '(no status)'}<select className={fieldClass} value={statuses[value]} disabled={disabled} onChange={event => setStatusChoice(previous => ({ ...previous, [value]: event.target.value as FeedbackStatus }))}>{pennyStatuses.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>)}</div></fieldset> : null}
      {Object.keys(tags).length ? <fieldset className="space-y-3"><legend className={fieldLabelClass}>Tags: Penny tag names for each Tags cell, separated by commas</legend><div className="grid gap-4 sm:grid-cols-2">{Object.entries(tags).map(([cell, text]) => <label key={cell} className={fieldLabelClass}>{cell}<input className={fieldClass} value={text} disabled={disabled} onChange={event => setTagChoice(previous => ({ ...previous, [cell]: event.target.value }))}/></label>)}</div></fieldset> : null}
      {kind === 'uservoice' ? <fieldset className="space-y-3"><legend className={fieldLabelClass}>Did the export include every idea?</legend><label className="flex min-h-11 items-center gap-3 text-sm"><input type="radio" name="uservoice-scope" checked={scope === 'complete'} disabled={disabled} onChange={() => setScope('complete')}/>Yes, no filters were applied</label><label className="flex min-h-11 items-center gap-3 text-sm"><input type="radio" name="uservoice-scope" checked={scope === 'filtered'} disabled={disabled} onChange={() => setScope('filtered')}/>No, it was a filtered view</label>{scope === 'filtered' ? <label className={fieldLabelClass}>Which filters?<input className={fieldClass} value={filter} required maxLength={500} placeholder="Status: open; Forum: Product ideas" disabled={disabled} onChange={event => setFilter(event.target.value)}/></label> : null}
        {uservoicePrivateColumns(main, voters).length ? <p className="text-sm text-penny-muted">Kept private, not mapped: {uservoicePrivateColumns(main, voters).join(', ')}.</p> : null}</fieldset> : null}
    </div> : null}
  </div>
}
