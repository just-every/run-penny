import type { ReactNode } from 'react'
import { dataLabelClass } from './classes'

// The customer pages' label, at the scale the owner approved for them.
const portalLabelClass = 'text-[11px] font-semibold tracking-[0.09em] text-penny-muted uppercase'

/**
 * A small-caps label over its value, for a definition list (<dl>). The one way the app shows a labelled fact; the value is
 * plain ink at reading size, and `valueClassName` adds to it (tabular numbers, breaking long IDs). `portal` keeps the
 * customer pages' smaller label and lets `valueClassName` set the value's whole type. An empty value reads "Not recorded".
 */
export function DataField({ label, children, valueClassName = '', portal = false, className = '' }: { readonly label: string; readonly children?: ReactNode; readonly valueClassName?: string; readonly portal?: boolean; readonly className?: string }) {
  return (
    <div className={`min-w-0 ${className}`.trim()}>
      <dt className={portal ? portalLabelClass : dataLabelClass}>{label}</dt>
      <dd className={`mt-1 break-words text-penny-ink ${portal ? '' : 'text-base sm:text-[17px] '}${valueClassName}`.trim()}>{children ?? 'Not recorded'}</dd>
    </div>
  )
}

/**
 * A row of DataFields: two columns on a phone, and from sm up one row of equal columns with a fine vertical rule between
 * them. Put it on the <dl>.
 */
export const dataRowClass = 'grid grid-cols-2 gap-x-5 gap-y-4 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none sm:[&>*+*]:border-l sm:[&>*+*]:border-penny-line sm:[&>*+*]:pl-5'
