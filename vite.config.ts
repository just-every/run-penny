import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, normalizePath } from 'vite'
import { localHostAdmission } from './scripts/installer/vite-host.js'
import { docsSite } from './src/core/features/docs/build/plugin.ts'
import { archiveOutputGuard } from '@runeditrun/rer/archive-output'

// Only `vite dev` loads the local-only entry and the checkout's dev key; a build
// keeps src/server.ts and never sees either (rer build checks its output).
const local = (name: string) => process.env[name] ? { [name]: process.env[name] } : {}
const serve = { main: './src/server.dev.ts', vars: { ...local('RER_DEV_ORIGIN'), ...local('RER_DEV_KEY'), ...local('RER_DEV_IDENTITY') } }
// Vite matches a pattern with a slash against the absolute path, so these name
// the checkout's own folders: `**/private/**` would deny a checkout that sits
// anywhere under a `private` folder, as macOS's /tmp (/private/tmp) does.
const checkout = (path: string) => normalizePath(fileURLToPath(new URL(`./${path}`, import.meta.url)))

export default defineConfig(({ command, isPreview }) => ({
  // `vite dev` serves only what the app is built from: never rer's private
  // folders (the dev key, installer state), export archives, settings or local
  // data. The Cloudflare plugin also denies .dev.vars and .wrangler.
  server: { fs: { strict: true, allow: ['src', 'public', 'base', 'scripts/portability', 'node_modules/@runeditrun/rer/modules/portability', 'node_modules/@runeditrun/rer/modules/erasure', 'seed.json', 'node_modules'].map(checkout),
    deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/*.rer', ...['.rer', '.seed', 'private', 'exports'].map(folder => checkout(folder) + '/**')] } },
  plugins: [localHostAdmission(), cloudflare({ persistState: { path: '.wrangler/state' },
    ...(command === 'serve' && !isPreview ? { config: serve } : process.env.RER_DEV_ORIGIN ? { config: { vars: local('RER_DEV_ORIGIN') } } : {}),
    inspectorPort: false, viteEnvironment: { name: 'ssr' } }),
    // /docs: the repository's Markdown rendered when Vite loads it (DOCS-001), never in the Worker or the browser.
    docsSite(),
    tanstackStart({ router: { entry: './core/app/router.tsx' }, prerender: { enabled: false } }), react(), tailwindcss(),
    // A build whose output holds an installation archive is refused.
    archiveOutputGuard()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}))
