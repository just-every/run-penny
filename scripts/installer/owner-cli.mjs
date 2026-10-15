import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { main as nativeOwner, report } from '@runeditrun/rer/modules/deploy-kit/owner-cli'
import { ownerSettings } from './owner-settings.mjs'
import { ownerDeclaration } from './owner-environment.mjs'
import { createRedaction, credentialValues } from '@runeditrun/rer/redaction'
import { cloudflare } from '@runeditrun/rer/modules/deploy-kit/provider'
import { registerDeploymentCrons } from '../deployment/cron-registration.mjs'

const redaction = createRedaction()

export async function main(argv = process.argv.slice(2), env = process.env, { cwd = process.cwd(), fetch = globalThis.fetch, store, healthOptions } = {}) {
  // pnpm run deploy:health -- FLAGS forwards the separator to this entry.
  if (argv[1] === '--') argv = [argv[0], ...argv.slice(2)]
  if (!['deploy', 'health'].includes(argv[0])) throw new Error('invalid-owner-command')
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { declaration: { type: 'string' }, environment: { type: 'string' }, state: { type: 'string' } } })
  const target = await ownerDeclaration(cwd, values.environment)
  if (positionals.length !== 1 || (values.declaration && values.declaration !== 'deploy.json') || (values.state && values.state !== target.stateFile)) throw new Error('invalid-owner-command')
  redaction.addSecrets(credentialValues(env))
  store ??= { addSecrets: redaction.addSecrets }
  const settings = await ownerSettings(cwd, env, store, { readOnly: argv[0] === 'health', environment: target.environment })
  let originMismatch = false
  const checkedFetch = async (url, options) => {
    const response = await fetch(url, options)
    if (settings.input.expectedOrigin && new URL(url).pathname.endsWith('/workers/subdomain') && response.ok) {
      const result = (await response.clone().json()).result
      if (`https://${settings.worker}.${result?.subdomain}.workers.dev` !== settings.input.expectedOrigin) {
        originMismatch = true
        throw new Error('owner-origin-mismatch')
      }
    }
    return response
  }
  try {
    const result = await nativeOwner([argv[0], '--declaration', settings.declarationFile, '--environment', settings.environment, '--state', settings.stateFile], { ...env, ...settings.values }, { cwd, fetch: checkedFetch, healthOptions })
    if (argv[0] === 'deploy') {
      const credentials = { ...env, ...settings.values }
      const api = cloudflare({ accountId: credentials.CLOUDFLARE_ACCOUNT_ID, token: credentials.CLOUDFLARE_API_TOKEN, fetch: checkedFetch })
      await registerDeploymentCrons(api, { worker: settings.worker, crons: target.declaration.crons ?? [] }, result.changed)
    }
    // The deploy hook hands rer the setup token this run put on the Worker; it is never printed.
    return { ...result, credentialFile: settings.credentialFile, ...(argv[0] === 'deploy' ? { setupToken: settings.values.SETUP_TOKEN } : {}) }
  }
  catch (error) { if (originMismatch) throw new Error('owner-origin-mismatch'); throw error }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const { setupToken, ...result } = await main(); console.log(redaction.redact(JSON.stringify(result))) }
  catch (error) { console.error(redaction.redact(JSON.stringify(error.inputs ? { ok: false, code: error.message, inputs: error.inputs } : report(error)))); process.exitCode = 1 }
}
