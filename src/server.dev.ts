// Local-only Worker entry. vite.config.ts loads it only for `vite dev`; the
// deployed main stays src/server.ts, and `rer build` refuses any output that
// contains the dev layer. It adds dev sign-in, personas and the dev badge.
import worker from './server'
import { withDevIdentity } from '../base/modules/operator-auth/dev/index.mjs'
import { devAuthConfig, devBindings } from './core/features/auth/dev-identity'
import { devPersonas } from './core/features/auth/dev-personas'
import type { AppBindings } from './core/shared/bindings'

export default withDevIdentity<AppBindings, typeof worker>(worker, { bindings: devBindings, config: devAuthConfig, personas: devPersonas })
