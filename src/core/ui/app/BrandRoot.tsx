import type { CSSProperties, ReactNode } from 'react'
import { CollageFilters } from '@/core/ui/brand/collage/Filters'

/**
 * The root of an app page: the brand's grained paper, ink and Inter Tight (.penny-brand), long user text still breaking
 * (.penny-app), the collage scope (.penny-collage) and the collage filters the copper marks refer to, mounted once per page.
 */
export function BrandRoot({ className = '', style, children }: { readonly className?: string; readonly style?: CSSProperties; readonly children: ReactNode }) {
  return (
    <div className={`penny-brand penny-app penny-collage ${className}`.trim()} style={style}>
      <CollageFilters />
      {children}
    </div>
  )
}
