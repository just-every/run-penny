import { SiteVariantContext, type SiteVariant } from '@/core/ui/site/SiteVariant';
import { CollageFilters } from '@/core/ui/brand/collage/Filters';
import { SiteFooter } from '@/core/ui/site/SiteFooter';
import { SiteHeader } from '@/core/ui/site/SiteHeader';
import '@/core/ui/site/styles';
import { DocsArticle } from './DocsArticle';
import { DocsMenu } from './DocsMenu';
import { DocsPager } from './DocsPager';
import { DocsSidebar } from './DocsSidebar';
import { DocsToc } from './DocsToc';
import './docs-theme.css';
import './styles';
import type { DocsView } from './types';
import { useCurrentDocs } from './useCurrentDocs';

/**
 * DOCS-001. A documentation page in Penny's public site: the landing's header (Docs marked current) and footer around the
 * section navigation, the article and its contents list, on the same grained paper with the same collage kit.
 */
export function DocsPage({ page, sections, repository, version, variant = 'instance' }: DocsView & { variant?: SiteVariant }) {
  useCurrentDocs(version);
  const order = sections.flatMap(section => section.pages.map(entry => ({ ...entry, section: section.title })));
  const index = order.findIndex(entry => entry.slug === page.slug);
  const current = order[index];
  return <SiteVariantContext.Provider value={variant}><div className="penny-docs penny-brand" id="top">
    <a className="pl-skip" href="#docs-content">Skip to the content</a>
    <CollageFilters />
    <SiteHeader current="docs" />
    <div className="docs-shell">
      <DocsSidebar sections={sections} current={page.slug} />
      <main id="docs-content" tabIndex={-1} className="docs-main">
        <DocsMenu sections={sections} current={page.slug} label={current.label} />
        <DocsArticle page={page} section={current.section} />
        <DocsPager previous={order[index - 1]} next={order[index + 1]} editUrl={`${repository.url}/edit/${repository.branch}/${page.source}`} />
      </main>
      <DocsToc toc={page.toc} />
    </div>
    <SiteFooter />
  </div></SiteVariantContext.Provider>;
}
