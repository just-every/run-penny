import { HydrationUnit } from '@/base/hydration/unit'
import { useSiteVariant } from '@/core/ui/site/SiteVariant';
import { CopperStroke } from '@/core/ui/brand/collage/Stroke';
import { DocsTocCompact } from './DocsToc';
import type { DocsPageData } from './types';
import { useProseLinks } from './useProseLinks';

/** The page's section, its title over the copper hand stroke, and its body, rendered from Markdown at build time. */
export function DocsArticle({ page, section }: { page: DocsPageData; section: string }) {
  const site = useSiteVariant() === 'site';
  return <>
    <HydrationUnit><header className="docs-page-head">
      <p className="docs-eyebrow">{section}</p>
      <h1 id={page.titleId} className="docs-title">{page.title}</h1>
      <CopperStroke className="docs-title-stroke" />
    </header></HydrationUnit>
    <HydrationUnit><DocsTocCompact toc={page.toc} /></HydrationUnit>
    <HydrationUnit>{site ? <div className="docs-prose" dangerouslySetInnerHTML={{ __html: page.html }} /> : <InteractiveProse html={page.html} />}</HydrationUnit>
  </>;
}

function InteractiveProse({ html }: { html: string }) {
  const followLink = useProseLinks();
  return <div className="docs-prose" onClick={followLink} dangerouslySetInnerHTML={{ __html: html }} />;
}
