import type { AppBindings } from '@/core/shared/bindings'

// Keep clean-clone Worker tests typed without generated wrangler declarations.
declare global {
  namespace Cloudflare {
    interface Env extends AppBindings {}

    interface GlobalProps {
      mainModule: typeof import('@/server')
    }
  }
}

export {}
