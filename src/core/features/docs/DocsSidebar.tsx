import { HydrationUnit } from '@/base/hydration/unit'
import { site, siteLinks } from '@/core/ui/site/site'
import { useSiteVariant } from '@/core/ui/site/SiteVariant'
import { DocsNavList } from './DocsNavList';
import type { DocsSection } from './types';

/** The section navigation beside the page, from 861px. The run site adds its contract page after the sections. */
export function DocsSidebar({ sections, current }: { sections: DocsSection[]; current: string }) {
  const variant = useSiteVariant()
  return <HydrationUnit><nav className="docs-sidebar" aria-label="Documentation">
    <DocsNavList sections={sections} current={current} idPrefix="docs-sidebar" />
    {variant === 'site' ? <div className="docs-nav-group"><ul><li><a href={siteLinks.contract}><span>{site.nav.contract}</span></a></li></ul></div> : null}
  </nav></HydrationUnit>;
}
