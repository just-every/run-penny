import type { ReactNode } from 'react'
import type { PublicRequestStatus, PublicRelease } from '@/core/shared/api/public'
import { Chip, type ChipTone } from '@/core/ui/app/Chip'
import { paperCardClass, secondaryButtonClass } from '@/core/features/portal/ui/portal-classes'
import { StarStamp } from '@/core/ui/brand/collage/Stamp'

type IconName = 'roadmap' | 'updates' | 'arrow' | 'plus' | 'vote' | 'comment' | 'external' | 'check' | 'bell'

const iconPaths: Record<IconName, string> = {
  roadmap: 'M4 5.25 9.25 3l5.5 2.25L20 3v15.75L14.75 21l-5.5-2.25L4 21V5.25Zm5.25-2.25v15.75m5.5-13.5V21',
  updates: 'm12.75 2.5-7 10h5l-.5 9 7-10h-5l.5-9Z',
  arrow: 'm9 18 6-6-6-6',
  plus: 'M12 5v14M5 12h14',
  vote: 'M7.25 10.25v9.25M4.5 10.25h2.75M10 19.5h7.06c.97 0 1.8-.68 1.99-1.63l.82-4.12a2 2 0 0 0-1.96-2.4h-4.18l.51-3.55A2 2 0 0 0 12.26 5.5h-.01L10 10.25v9.25Z',
  comment: 'M4 5.75A2.75 2.75 0 0 1 6.75 3h10.5A2.75 2.75 0 0 1 20 5.75v6.5A2.75 2.75 0 0 1 17.25 15H11l-4.25 3v-3H6.75A2.75 2.75 0 0 1 4 12.25v-6.5Z',
  external: 'M13 5h6v6M19 5l-8.5 8.5M18 13v5.25A1.75 1.75 0 0 1 16.25 20h-10.5A1.75 1.75 0 0 1 4 18.25V7.75A1.75 1.75 0 0 1 5.75 6H11',
  check: 'm5.5 12 4 4L18.5 7',
  bell: 'M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Zm4 10.5a2 2 0 0 0 4 0',
}

export function PortalIcon({ name, className = 'size-4' }: { readonly name: IconName; readonly className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={iconPaths[name]} />
    </svg>
  )
}

const statusLabels: Record<PublicRequestStatus, string> = {
  open: 'Open',
  under_review: 'Under review',
  planned: 'Planned',
  in_progress: 'In progress',
  shipped: 'Shipped',
  declined: 'Declined',
}

const statusTones: Record<PublicRequestStatus, ChipTone> = {
  open: 'neutral',
  under_review: 'sand',
  planned: 'copper-outline',
  in_progress: 'copper',
  shipped: 'moss',
  declined: 'muted',
}

export function PublicStatus({ status }: { readonly status: PublicRequestStatus }) {
  return <Chip portal tone={statusTones[status]}>{statusLabels[status]}</Chip>
}

export function ReleaseType({ type }: { readonly type: PublicRelease['releaseType'] }) {
  const label = type === 'new' ? 'New' : type === 'improved' ? 'Improved' : 'Fixed'
  return <Chip portal tone="sand">{label}</Chip>
}

export function PublicCard({ children, className = '' }: { readonly children: ReactNode; readonly className?: string }) {
  return <section className={`${paperCardClass} ${className}`}>{children}</section>
}

export function ResourceLoading({ label = 'Loading public information…' }: { readonly label?: string }) {
  return (
    <div className={`${paperCardClass} px-5 py-8 text-sm text-penny-muted`} role="status" aria-live="polite">
      <span className="inline-flex items-center gap-3"><span className="size-3 animate-pulse rounded-full bg-penny-copper/45" aria-hidden="true" />{label}</span>
    </div>
  )
}

export function ResourceFailure({ status, onRetry }: { readonly status?: number; readonly onRetry: () => void }) {
  const message = status === 404
    ? 'This public record is not available.'
    : status === 410
      ? 'This feedback has been withdrawn.'
      : 'We could not load this public information.'
  return (
    <div className={`${paperCardClass} px-5 py-8`} role="alert">
      <p className="font-semibold text-penny-ink">{message}</p>
      {status !== 404 && status !== 410 ? <button type="button" onClick={onRetry} className={`${secondaryButtonClass} mt-4`}>Try again</button> : null}
    </div>
  )
}

/** A customer page's empty list: the dashed paper panel with the small star stamp, a heading and what happens next. */
export function PublicEmpty({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-dashed border-penny-line-strong/60 bg-penny-card/60 px-5 py-8 text-center">
      <svg className="mx-auto mb-3 block size-9" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><StarStamp cx={20} cy={20} r={16} seed={21} /></svg>
      <h2 className="text-base font-bold text-penny-ink">{title}</h2>
      <div className="mt-2 text-sm leading-6 text-penny-muted">{children}</div>
    </div>
  )
}
