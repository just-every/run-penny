import { env } from 'cloudflare:workers'
import { beforeEach } from 'vitest'
import { clearPredecessorNotificationState } from './predecessor-storage'

beforeEach(() => clearPredecessorNotificationState(env.DB))
