import { applyD1Migrations } from 'cloudflare:test'
import { env, exports } from 'cloudflare:workers'
import { beforeAll, describe, expect, inject, it } from 'vitest'

const ORIGIN = 'https://penny.test'

beforeAll(async () => {
  await applyD1Migrations(env.DB, inject('migrations'))
})

async function landing(): Promise<{ response: Response; html: string }> {
  const response = await exports.default.fetch(new Request(`${ORIGIN}/`, { headers: { Accept: 'text/html' } }))
  return { response, html: await response.text() }
}

const attributes = (html: string, pattern: RegExp) => [...html.matchAll(pattern)].map((match) => match[1])

describe('Public product landing', () => {
  it('[HOME-002] serves the finished landing at / with labelled sections and its links, sets no cookie and loads nothing from another origin', async () => {
    const { response, html } = await landing()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(response.headers.get('set-cookie')).toBeNull()

    // One page heading, and every section is a landmark named by a heading the server already rendered.
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    const sections = attributes(html, /<section\b[^>]*\baria-labelledby="([^"]+)"/g)
    expect(sections.length).toBeGreaterThanOrEqual(6)
    expect(html.match(/<section\b/g)).toHaveLength(sections.length)
    for (const id of sections) expect(html).toMatch(new RegExp(`<h[12]\\b[^>]*\\bid="${id}"`))
    for (const landmark of ['<header', '<main', '<footer']) expect(html).toContain(landmark)

    // Each drawing is described for assistive technology.
    const drawings = attributes(html, /role="img"[^>]*\baria-label="([^"]*)"/g)
    expect(drawings.length).toBeGreaterThanOrEqual(6)
    for (const label of drawings) expect(label.trim()).not.toBe('')

    const links = attributes(html, /<a\b[^>]*\bhref="([^"]+)"/g)
    expect(links).toEqual(expect.arrayContaining(['/signin', '/docs', '/portal']))

    const resources = [
      ...attributes(html, /<(?:script|img|source|iframe|video|audio)\b[^>]*\bsrc="([^"]+)"/g),
      ...attributes(html, /<link\b[^>]*\bhref="([^"]+)"/g),
      ...attributes(html, /url\((?:&quot;|['"])?([^)'"&]+)/g),
    ]
    expect(resources.length).toBeGreaterThan(0)
    const foreign = resources.filter((url) => !url.startsWith('data:') && new URL(url, ORIGIN).origin !== ORIGIN)
    expect(foreign).toEqual([])
  })

  it('[REQ-001] sends a board link shared before the board moved from / to /portal/feedback with the same query', async () => {
    for (const query of ['?q=SCIM', '?status=shipped', '?board=enterprise-identity', '?sort=votes', '?sort=votes&status=shipped&board=enterprise-identity&q=SCIM%20sync']) {
      const response = await exports.default.fetch(new Request(`${ORIGIN}/${query}`, { headers: { Accept: 'text/html' }, redirect: 'manual' }))
      expect(response.status, query).toBe(302)
      expect(response.headers.get('Location'), query).toBe(`/portal/feedback${query}`)
    }
    const { response, html } = await landing()
    expect(response.status).toBe(200)
    expect(html.match(/<h1\b/g)).toHaveLength(1)
  })
})
