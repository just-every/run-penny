import { ownerConfiguration } from './owner-settings.mjs'
import { ownerDeclaration } from './owner-environment.mjs'
import { main as owner } from './owner-cli.mjs'
import { ownerPlan, localOnlyBinding } from '@runeditrun/rer/modules/deploy-kit/owner'
import { packageBuild } from '@runeditrun/rer/modules/deploy-kit/prepare'
import { refuse } from '@runeditrun/rer/errors'
export async function deployPenny(context) {
  const { commandAdapter } = await import('./local.mjs')
  const target = await ownerDeclaration(context.root, context.options.environment)
  const local = localOnlyBinding(target.declaration, context.localOnlyKeys)
  if (local) throw refuse(`deploy.json names the local-only key ${local} as a deploy binding or secret. Remove it; local dev keys never reach a deployment.`)
  if (!context.options.dryRun) await ownerConfiguration(context.root, process.env, target.environment)
  await commandAdapter.run(context.root, {}, context.store, () => {}, context.signal, { verb: 'build', operationToken: context.operationToken })
  await context.checkBuild?.()
  if (context.options.dryRun) {
    const artifact = await packageBuild({ root: context.root, source: { sha: '0'.repeat(40), tree: '0'.repeat(40) }, runIdentity: { id: '0', attempt: '1' }, productDirectory: '' })
    const plan = ownerPlan({ ...target, project: target.declaration.project, origin: `https://${target.worker}.example.invalid` }, target.declaration, artifact, { localOnlyKeys: context.localOnlyKeys })
    const resources = Object.fromEntries(['d1', 'r2', 'queues'].map(kind => [kind, plan[kind].map(item => item.name)]))
    const schedules = plan.crons.map(cron => ({ cron }))
    context.store.report(`deploy: ${JSON.stringify({ environment: target.environment, worker: target.worker, resources, schedules, scheduleRegistration: 'PUT after changed Worker upload; read back exact set', runtimeEnvironment: plan.vars.PENNY_ENVIRONMENT, state: target.stateFile, credentialFile: target.credentialFile, declarationFile: target.declarationFile })}`)
    context.store.report('deploy: dry run complete; no deployment occurred and no provider request was made.')
    return { dryRun: true, deployed: false, environment: target.environment, worker: target.worker, resources, schedules, state: target.stateFile }
  }
  const env = { ...process.env, RER_LOCAL_OPERATION: context.operationToken }
  const args = ['--environment', target.environment]
  const result = await owner(['deploy', ...args], env, { cwd: context.root, store: context.store })
  await owner(['health', ...args], env, { cwd: context.root, store: context.store })
  return { deployed: true, origin: result.origin, state: target.stateFile, setupToken: result.setupToken }
}
