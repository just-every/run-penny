import { applyD1Migrations } from 'cloudflare:test'
import { env, exports } from 'cloudflare:workers'
import { beforeAll, describe, expect, inject, it } from 'vitest'
import site from '../../../docs/site.json'

const request = (path: string) => exports.default.fetch(new Request(`https://penny.test${path}`, { headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' }, redirect: 'manual' }))
const pages = site.sections.flatMap((section) => section.pages.map((page) => ({ ...page, href: page.slug ? `/docs/${page.slug}` : '/docs' })))

beforeAll(async () => {
  await applyD1Migrations(env.DB, inject('migrations'))
})

describe('first-party documentation', () => {
  it('[DOCS-001] serves every published page at its public address as server-rendered article HTML', async () => {
    for (const page of pages) {
      const response = await request(page.href)
      expect(response.status, page.href).toBe(200)
      expect(response.headers.get('Set-Cookie'), page.href).toBeNull()
      const html = await response.text()
      expect(html, page.href).toMatch(/<h1 id="[^"]+" class="docs-title">[^<]+<\/h1>/)
      expect(html, page.href).toMatch(/<div class="docs-prose"><(p|h2|ul|ol|pre|div)[\s>]/)
      expect(html, page.href).toContain('<script')
      for (const entry of pages) expect(html, `${page.href} navigation`).toContain(`href="${entry.href}"`)
      expect(html, page.href).toContain('href="/portal"')
      expect(html, page.href).toContain('href="/signin"')
    }
  })

  it('[DOCS-001] answers an unknown docs page with a genuine 404 and no article', async () => {
    for (const path of ['/docs/nope', '/docs/install/extra']) {
      const response = await request(path)
      expect(response.status, path).toBe(404)
      const html = await response.text()
      expect(html, path).toContain('That page does not exist.')
      expect(html, path).not.toContain('class="docs-prose"')
    }
  })
})
