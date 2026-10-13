import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

// DOCS-001. The /docs pages are built from the repository's Markdown listed in docs/site.json
// (src/core/features/docs/build). These checks import the same build modules the Vite plugin runs; the page routes
// themselves are exercised through the Worker in tests/e2e/worker/docs.test.ts.
const root = fileURLToPath(new URL('../..', import.meta.url))
const { readManifest } = await import('../../src/core/features/docs/build/manifest.ts')
const { buildSite } = await import('../../src/core/features/docs/build/site.ts')
const { docsSite } = await import('../../src/core/features/docs/build/plugin.ts')

test('[DOCS-001] every Markdown file at the root, under docs/ or as a top-level README is published or listed as GitHub-only', () => {
  const manifest = readManifest(root)
  const listed = new Set([...manifest.pages, ...manifest.githubOnly].map((entry) => entry.source))
  const inScope = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.md'], { cwd: root, encoding: 'utf8' })
    .split('\n').filter((file) => /^([^/]+\.md|docs\/.+\.md|[^./][^/]*\/README\.md)$/.test(file))
  assert.ok(inScope.length >= 20, 'the scope is found')
  const unlisted = inScope.filter((file) => !listed.has(file))
  assert.deepEqual(unlisted, [], `Add ${unlisted.join(', ')} to docs/site.json, as a published page or under githubOnly with a reason`)
  assert.equal(listed.size, manifest.pages.length + manifest.githubOnly.length, 'no source is listed twice')
  for (const entry of manifest.githubOnly) assert.ok(entry.reason.length > 10, `${entry.source} says why it stays on GitHub`)
})

test('[DOCS-001] the published pages build with no problems, one title each and only resolvable links', () => {
  const site = buildSite(root)
  assert.deepEqual(site.problems, [])
  const published = new Map(site.pages.map((page) => [page.href, new Set(page.ids)]))
  for (const page of site.pages) {
    const markdown = readFileSync(join(root, page.source), 'utf8')
    assert.match(markdown.trimStart(), /^# /, `${page.source} starts with its H1`)
    assert.doesNotMatch(page.html, /<h1\b/, `${page.source} has exactly one H1, rendered by the page`)
    assert.equal(new Set(page.ids).size, page.ids.length, `${page.source} heading ids are unique`)
    assert.doesNotMatch(page.html, /\s(style|on[a-z]+)=|<script/i, `${page.source} has no inline style, handler or script`)
    for (const [, href] of page.html.matchAll(/<a href="([^"]+)"/g)) {
      const decoded = href.replaceAll('&amp;', '&')
      if (!decoded.startsWith('/docs')) continue
      const [path, hash] = decoded.split('#')
      assert.ok(published.has(path), `${page.source}: ${href} is a published page`)
      if (hash) assert.ok(published.get(path).has(decodeURIComponent(hash)), `${page.source}: ${href} names a heading`)
    }
  }
})

test('[DOCS-001] a broken link or anchor fails the docs build, naming the file and the link', async () => {
  const fixture = await realpath(await mkdtemp(join(tmpdir(), 'penny-docs-site-')))
  try {
    await mkdir(join(fixture, 'docs'))
    await writeFile(join(fixture, 'package.json'), JSON.stringify({ repository: { url: 'https://github.com/just-every/run-penny.git' } }))
    await writeFile(join(fixture, 'docs/site.json'), JSON.stringify({ sections: [{ title: 'S', pages: [{ slug: '', source: 'README.md', label: 'Home' }, { slug: 'guide', source: 'docs/GUIDE.md', label: 'Guide' }] }], githubOnly: [{ source: 'NOTES.md', reason: 'Maintainer notes' }] }))
    await writeFile(join(fixture, 'README.md'), '# Home\n\n[guide](docs/GUIDE.md#second) [site](/docs/guide#second) [bad](docs/GUIDE.md#third) [notes](NOTES.md#kept) [gone](NOTES.md#lost) [missing](docs/MISSING.md) [unpublished](/docs/nope) [self](#nowhere)\n')
    await writeFile(join(fixture, 'docs/GUIDE.md'), '# Guide\n\n## Second\n')
    await writeFile(join(fixture, 'NOTES.md'), '# Notes\n\n## Kept\n')
    const site = buildSite(fixture)
    assert.deepEqual(site.problems, [
      'README.md: docs/MISSING.md (docs/MISSING.md does not exist)',
      'README.md: /docs/nope (not a published docs page; use a path relative to README.md)',
      'README.md: #third (no such heading in docs/GUIDE.md)',
      'README.md: #lost (no such heading in NOTES.md)',
      'README.md: #nowhere (no such heading in README.md)',
    ])
    assert.equal(site.pages[0].html.match(/href="\/docs\/guide#second"/g)?.length, 2, 'file and site links to a published page both reach it')
    assert.match(site.pages[0].html, /href="https:\/\/github\.com\/just-every\/run-penny\/blob\/main\/NOTES\.md#kept"/)

    await writeFile(join(fixture, 'entry.js'), "import { pages } from 'virtual:penny-docs'\nexport default pages\n")
    await assert.rejects(
      build({ root: fixture, configFile: false, logLevel: 'silent', plugins: [docsSite()], build: { write: false, lib: { entry: join(fixture, 'entry.js'), formats: ['es'] } } }),
      (error) => error.message.includes('5 broken link(s)') && error.message.includes('README.md: /docs/nope'),
      'the Vite build stops on the broken links',
    )
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})

test('[DOCS-001] raw HTML in the Markdown is shown as text, and an image outside docs/media or an absolute machine path fails the build', async () => {
  const fixture = await realpath(await mkdtemp(join(tmpdir(), 'penny-docs-hostile-')))
  try {
    await mkdir(join(fixture, 'docs/media'), { recursive: true })
    await writeFile(join(fixture, 'package.json'), JSON.stringify({ repository: { url: 'https://github.com/just-every/run-penny.git' } }))
    await writeFile(join(fixture, 'docs/site.json'), JSON.stringify({ sections: [{ title: 'S', pages: [{ slug: '', source: 'README.md', label: 'Home' }] }], githubOnly: [{ source: 'docs/ELSEWHERE.md', reason: 'Kept on GitHub only' }] }))
    await writeFile(join(fixture, 'docs/media/ok.png'), 'png')
    await writeFile(join(fixture, 'docs/ELSEWHERE.md'), '# Elsewhere\n')

    // Raw HTML is escaped, and a fixture with an allowed image and no machine path builds clean.
    await writeFile(join(fixture, 'README.md'), '# Home\n\n<b onclick="x()">bold</b> <script>alert(1)</script> <img src="x" onerror="y()">\n\n![ok](docs/media/ok.png)\n')
    const clean = buildSite(fixture)
    assert.deepEqual(clean.problems, [])
    assert.match(clean.pages[0].html, /&lt;b onclick=/)
    assert.match(clean.pages[0].html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
    assert.doesNotMatch(clean.pages[0].html, /<script|<b[\s>]/)
    assert.deepEqual(clean.pages[0].html.match(/<img\b[^>]*>/g)?.length, 1, 'only the allowed image is an element')
    assert.doesNotMatch(clean.pages[0].html.match(/<img\b[^>]*>/)[0], /onerror/)

    // An image outside docs/media, an external or root-relative image, and an absolute build-machine path each fail.
    // The home directory is assembled so this source file itself names no machine path.
    const home = '/' + 'Users/someone'
    await writeFile(join(fixture, 'docs/outside.png'), 'png')
    await writeFile(join(fixture, 'README.md'), `# Home\n\n![outside](docs/outside.png) ![root](${home}/shot.png) ![remote](https://example.com/a.png)\n\nBuilt in ${home}/project/docs and /private/tmp/build.\n`)
    const hostile = buildSite(fixture)
    const problem = (fragment) => hostile.problems.some((line) => line.startsWith('README.md: ') && line.includes(fragment))
    assert.ok(hostile.problems.includes('README.md: docs/outside.png (images must be files in docs/media/)'), 'an image outside docs/media fails')
    assert.ok(hostile.problems.includes(`README.md: ${home}/shot.png (images must be files in docs/media/)`), 'a root-relative image fails')
    assert.ok(hostile.problems.includes('README.md: https://example.com/a.png (images must be files in docs/media/)'), 'a remote image fails')
    assert.ok(problem(`${home}/project/docs (an absolute machine path`), 'a home path in the text fails')
    assert.ok(problem('/private/tmp/build'), 'a temp path in the text fails')

    await writeFile(join(fixture, 'entry.js'), "import { pages } from 'virtual:penny-docs'\nexport default pages\n")
    await assert.rejects(
      build({ root: fixture, configFile: false, logLevel: 'silent', plugins: [docsSite()], build: { write: false, lib: { entry: join(fixture, 'entry.js'), formats: ['es'] } } }),
      (error) => error.message.includes('broken link(s)') && error.message.includes('images must be files in docs/media/') && error.message.includes('an absolute machine path'),
      'the Vite build stops on the image and the machine path',
    )
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})
