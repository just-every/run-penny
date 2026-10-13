import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { runPageHtml, siteNotFoundHtml, type SiteBuild, type SiteContext } from '../base/run-site'
import { identity } from '../identity'
import { run } from './run'
import { Landing } from '../core/features/landing/Landing'
import { copy } from '../core/features/landing/copy'
import { DocsPage } from '../core/features/docs/DocsPage'
import { fontLinks } from '../core/ui/brand/font-head'
import { pages, problem, repository, sections, version } from 'virtual:penny-docs'
import '../index.css'
import '../core/ui/brand/styles'

export async function sitePages({ styles }: SiteContext): Promise<SiteBuild> {
  if (problem) throw new Error(problem)
  const document = (title: string, description: string, body: ReactElement) => '<!doctype html>' + renderToStaticMarkup(
    <html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title><meta name="description" content={description} /><link rel="icon" href={identity.mark} />
      {fontLinks.map(link => <link key={link.href} {...link} />)}
      {styles.map(href => <link key={href} rel="stylesheet" href={href} />)}
    </head><body>{body}</body></html>)
  const docs = await Promise.all(Object.entries(pages).map(async ([slug, load]) => {
    const page = (await load()).default
    return { path: slug ? `/docs/${slug}` : '/docs', html: document(slug ? `${page.title} · Penny docs` : 'Penny docs', page.description,
      <DocsPage page={page} repository={repository} sections={sections} version={version} variant="site" />) }
  }))
  return {
    pages: [
      { path: '/', html: document(copy.meta.title, copy.meta.description, <Landing variant="site" />) },
      { path: '/run', html: runPageHtml(identity, run) },
      ...docs,
      { path: '/404', html: siteNotFoundHtml(identity, run) },
    ],
    assets: ['rer-theme.css', 'fonts', 'brand'],
  }
}
