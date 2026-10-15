import { useEffect,type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { primaryButtonClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { EmptyState } from '@/core/ui/app/EmptyState'
import { EmptyArt, ErrorArt } from '@/core/ui/app/collage/EmptyArt'
import { IconDisc } from '@/core/ui/app/Icon'
import { OperatorCard } from './operator-primitives'

export function OperatorResourceLoading({ label }: { readonly label: string }) {
  return <OperatorCard className="p-6" role="status" aria-live="polite"><span className="inline-flex items-center gap-3 text-sm font-medium text-penny-muted"><span className="size-3 animate-pulse rounded-full bg-penny-copper/45" aria-hidden="true" />{label}</span></OperatorCard>
}

export function OperatorResourceFailure({ title, onRetry, status, message }: { readonly title: string; readonly onRetry: () => void; readonly status?: number; readonly message?: string }) {
  return (
    <OperatorCard className="flex items-start gap-4 p-5 sm:gap-8 sm:p-10" role="alert">
      <IconDisc name="warning" size="error" />
      <div className="min-w-0 pt-1 sm:pt-3">
        <h2 className="text-2xl leading-[1.15] font-extrabold tracking-[-0.01em] text-penny-ink sm:text-[28px]">{title}</h2>
        <p className="mt-1.5 text-base text-penny-muted sm:mt-2 sm:text-lg">{message ?? (status ? `Penny returned ${status}.` : 'Check your connection and try again.')}</p>
        <button type="button" onClick={onRetry} className={`${secondaryButtonClass} mt-4 sm:mt-6`}>Try again</button>
      </div>
      <ErrorArt className="ml-auto hidden w-[min(400px,40%)] self-center lg:block" />
    </OperatorCard>
  )
}

/** A missing record: the empty-state drawing with a heading and what happened. */
export function OperatorResourceNotFound({ title, children }: { readonly title: string; readonly children: string }) {
  return <OperatorCard className="px-5 py-8 text-center sm:py-10"><EmptyArt note="Nothing here." className="mx-auto w-[280px] max-w-full sm:w-[360px]" /><h2 className="mt-3 text-2xl font-extrabold tracking-[-0.01em] text-penny-ink sm:text-[28px]">{title}</h2><p className="mx-auto mt-2 max-w-2xl text-base leading-normal text-penny-muted sm:text-lg">{children}</p></OperatorCard>
}

export function OperatorEmpty({ title, note, small, children }: { readonly title: string; readonly note?: string; readonly small?: boolean; readonly children: ReactNode }) {
  return <EmptyState title={title} note={note} small={small}>{children}</EmptyState>
}

export function OperatorSessionExpired() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.location.assign('/signin'), 1400)
    return () => window.clearTimeout(timer)
  }, [])

  return <OperatorCard className="p-6" role="alert"><h2 className="font-bold text-penny-ink">Your operator session has expired.</h2><p className="mt-2 text-sm leading-6 text-penny-muted">Penny will return you to sign in shortly.</p><Link to="/signin" className={`${primaryButtonClass} mt-4`}>Sign in now</Link></OperatorCard>
}
