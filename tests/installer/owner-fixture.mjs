import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ownerProvider } from './cloudflare-account.mjs'

// Test-only emitted build and provider. The declaration and entire migration
// inventory are Penny's real inputs to the maintained owner CLI.
export async function ownerFixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'penny-owner-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const directory of ['dist/server', 'dist/client']) await mkdir(join(root, directory), { recursive: true })
  await writeFile(join(root, 'dist/server/wrangler.json'), JSON.stringify({ main: 'index.js', no_bundle: true, rules: [{ type: 'ESModule', globs: ['**/*.js', '**/*.mjs'] }] }))
  await writeFile(join(root, 'dist/server/index.js'), 'export default {fetch(){return new Response("test-only")},scheduled(){},queue(){}}')
  await writeFile(join(root, 'dist/client/index.html'), '<h1>Test-only Penny package</h1>')
  await cp(new URL('../../migrations', import.meta.url), join(root, 'migrations'), { recursive: true })
  await cp(new URL('../../deploy.json', import.meta.url), join(root, 'deploy.json'))
  await writeFile(join(root, '.gitignore'), 'dist/\n.rer/\n.wrangler/\n')
  const git = (...args) => execFileSync('git', ['-c', 'user.email=test@penny.invalid', '-c', 'user.name=Penny tests', '-c', 'commit.gpgsign=false', ...args], { cwd: root, stdio: 'pipe' })
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'Test-only source')
  const provider = ownerProvider()
  t.after(() => provider.close())
  const env = { CLOUDFLARE_ACCOUNT_ID: provider.accountId, CLOUDFLARE_API_TOKEN: provider.token, OPERATOR_EMAIL: 'owner@penny.invalid', MAIL_PROVIDER: 'later' }
  const options = { cwd: root, fetch: provider.fetch }
  return { root, provider, env, options, git }
}
