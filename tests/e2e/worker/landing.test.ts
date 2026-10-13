import { applyD1Migrations } from 'cloudflare:test'
import { env, exports } from 'cloudflare:workers'
import { beforeAll, describe, expect, inject, it } from 'vitest'

const ORIGIN = 'https://penny.test'
beforeAll(async () => { await applyD1Migrations(env.DB, inject('migrations')) })

// The installed root is the public board; the marketing page belongs to the separate run site.
describe('Installed public board', () => {
  it('[REQ-001] server-renders the board and retains root filters, public navigation and cookie-free admission', async () => {
    for (const query of ['', '?q=SCIM', '?status=shipped', '?board=enterprise-identity', '?sort=votes', '?sort=votes&status=shipped&board=enterprise-identity&q=SCIM%20sync']) {
      const response = await exports.default.fetch(new Request(`${ORIGIN}/${query}`, { headers: { Accept: 'text/html' }, redirect: 'manual' }))
      expect(response.status, query).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/html')
      expect(response.headers.get('set-cookie')).toBeNull()
      expect(response.headers.get('cache-control')).toContain('no-transform')
      const html = await response.text()
      expect(html).toContain('id="feedback-heading"')
      expect(html).toContain('name="q"')
      expect(html).toContain('name="status"')
      expect(html).toContain('action="/"')
      expect(html).toContain('href="/signin"')
      expect(html).toContain('href="/portal/feedback/new"')
      expect(html).not.toContain('Loading published feedback')
      if (query.includes('q=')) expect(html).toContain('value="SCIM')
      const resources = [...html.matchAll(/<(?:script|img|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map(match => match[1])
      expect(resources.filter(path => !path.startsWith('data:') && new URL(path, ORIGIN).origin !== ORIGIN)).toEqual([])
    }
    const compatibility = await exports.default.fetch(new Request(`${ORIGIN}/portal?q=SCIM&sort=votes`, { redirect: 'manual' }))
    expect(compatibility.status).toBe(302)
    expect(compatibility.headers.get('location')).toBe('/?q=SCIM&sort=votes')
    const detail = await exports.default.fetch(new Request(`${ORIGIN}/portal/feedback/no-such-request`, { headers: { Accept: 'text/html' } }))
    expect(detail.status).toBe(404)
  })
})
