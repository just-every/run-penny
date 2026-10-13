import type { AppBindings } from '@/core/shared/bindings'

// `wrangler types` writes the same declarations into the generated
// `worker-configuration.d.ts`, which is ignored by Git and therefore absent
// from a clean clone. The bindings are already declared once in
// `src/core/shared/bindings.ts` and the entry module is `wrangler.jsonc`'s
// `main`, so the Worker environment seen by `cloudflare:workers` is derived
// from those rather than from a generated artefact.
declare global {
  namespace Cloudflare {
    interface Env extends AppBindings {}

    interface GlobalProps {
      mainModule: typeof import('@/server')
    }
  }
}

export {}
