import { createD1DevelopmentOutbox, createDevelopmentOutboxHandler } from '../../../../base/modules/mail/src/development/index.mjs'
import { devGate, devNotFound } from '../../../../base/modules/operator-auth/index.mjs'
import type { Hono } from 'hono'
import type { PennyRuntime } from '@/core/app/runtime'
import type { AppBindings } from '@/core/shared/bindings'

/** Explicit local configuration only: a missing remote provider never enables capture. */
export function localOutbox(runtime: PennyRuntime) {
  const {environment, mailProvider, appOrigin} = runtime.configuration
  if (environment !== 'local' || mailProvider !== 'development' || !appOrigin) return undefined
  const url = new URL(appOrigin)
  if (url.protocol !== 'http:' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) return undefined
  return createD1DevelopmentOutbox({db:runtime.database.binding})
}
// The outbox and the key exchange answer only a local runtime holding the
// checkout's RER_DEV_KEY. A tunnel or local proxy makes remote requests look
// local, so the outbox also needs the key gate's cookie (or rer's key header).
export function registerLocalOutbox(app: Hono<{Bindings:AppBindings;Variables:{runtime:PennyRuntime}}>) {
  app.on(['GET','HEAD','POST'], ['/__dev/outbox','/__dev/key'], async (context, next) => {
    const runtime = context.get('runtime'), outbox = localOutbox(runtime)
    if (!outbox) return next()
    const gate = devGate({ key: runtime.bindings.RER_DEV_KEY, origin: runtime.configuration.appOrigin!, local: true })
    if (!gate) return devNotFound()
    if (context.req.path === '/__dev/key') return (await gate.exchange(context.req.raw)) ?? devNotFound()
    if (!await gate.admits(context.req.raw)) return devNotFound()
    const response = await createDevelopmentOutboxHandler({local:true,origin:runtime.configuration.appOrigin!,outbox})(context.req.raw)
    return response ?? next()
  })
}
