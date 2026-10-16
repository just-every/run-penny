import { paperCardClass } from '@/core/ui/app/classes'
export const card = `${paperCardClass} p-5 sm:p-7`
export const heading = 'text-lg font-bold tracking-[-0.01em] text-penny-ink'
export const lede = 'mt-3 leading-7 text-penny-ink'
export const note = 'mt-3 text-sm leading-6 text-penny-muted'
/** `scope` places the line in the card whose action it reports (the restore card). */
export type Status = { kind: 'working' | 'success' | 'error'; text: string; scope?: 'restore' } | null
/** The page's one busy state and status line, shared by each data card. */
export interface DataPageActions { busy: boolean; status: Status; perform: (progress: string, action: () => Promise<void>, scope?: 'restore') => Promise<void> }
