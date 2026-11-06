import type { FeedRelease } from './public-read-repository'

export const releaseFeedPaths = {
  rss: '/api/public/releases/rss.xml',
  atom: '/api/public/releases/atom.xml',
} as const

export type ReleaseFeedFormat = keyof typeof releaseFeedPaths

// XML 1.0 text must exclude disallowed controls as well as escape markup.
function xml(value: string): string {
  // eslint-disable-next-line no-control-regex -- XML 1.0 excludes these characters.
  return value.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export function releaseFeed(format: ReleaseFeedFormat, origin: string, releases: readonly FeedRelease[]): string {
  const changelog = new URL('/portal/updates', origin).href
  const self = new URL(releaseFeedPaths[format], origin).href
  const link = (release: FeedRelease) => `${changelog}/${encodeURIComponent(release.slug)}`
  const published = (release: FeedRelease) => `${release.publicationDate}T00:00:00.000Z`
  const declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'

  if (format === 'rss') {
    // RSS descriptions are HTML: encode the Markdown as literal text before XML encoding.
    return declaration + `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>Penny changelog</title><link>${xml(changelog)}</link><description>Published release notes from Penny.</description>
<atom:link href="${xml(self)}" rel="self" type="application/rss+xml"/>
${releases.map(release => `<item><guid isPermaLink="true">${xml(link(release))}</guid><link>${xml(link(release))}</link>
<title>${xml(release.title)}</title><pubDate>${new Date(published(release)).toUTCString()}</pubDate>
<description>${xml(xml(release.body))}</description></item>`).join('\n')}
</channel></rss>`
  }

  // A deterministic epoch keeps an empty Atom feed valid without a changing clock.
  const updated = releases.map(release => release.updatedAt).sort().at(-1) ?? '1970-01-01T00:00:00.000Z'
  return declaration + `<feed xmlns="http://www.w3.org/2005/Atom">
<id>${xml(changelog)}</id><title type="text">Penny changelog</title><updated>${xml(updated)}</updated>
<author><name>Penny</name></author><link href="${xml(changelog)}" rel="alternate" type="text/html"/>
<link href="${xml(self)}" rel="self" type="application/atom+xml"/>
${releases.map(release => `<entry><id>${xml(link(release))}</id><link href="${xml(link(release))}" rel="alternate" type="text/html"/>
<title type="text">${xml(release.title)}</title><published>${published(release)}</published><updated>${xml(release.updatedAt)}</updated>
<author><name>${xml(release.authorName)}</name></author><content type="text">${xml(release.body)}</content></entry>`).join('\n')}
</feed>`
}
