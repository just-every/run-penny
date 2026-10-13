import { commandAdapter as createCommandAdapter } from '../base-cli/cli/adapter.mjs'
import { previewTarget } from '../base-onboarding/operator-installer.mjs'
import { operatorPrerequisites } from '../base-onboarding/operator-prerequisites.mjs'
import { deployPenny } from './deploy.mjs'
import { pennyPortability } from '../portability/adapter.mjs'
import { localInstaller, ownerAccountHosting } from '../base-onboarding/adapter.mjs'
import { prepareLocal, savedOrigin, commandEnvironment, runtimeEnvironment, localState } from './settings.mjs'
import {manifest} from './manifest.mjs'
import { features } from './ui/seed.mjs'
import { applyMigrations } from './migrations.mjs'
import { assertLocalAdmission, admissionOutput } from './admission.mjs'
import { buildSource } from './build-source.mjs'
import { ownerDeclaration } from './owner-environment.mjs'

const definitions = {
  node: '22.20.0', tools: ['pnpm'], prepare: prepareLocal, sessionSecretKey: 'AUTH_SECRET',
  dependencies: ['pnpm', ['install', '--frozen-lockfile'], { env: commandEnvironment() }],
  origin: savedOrigin,
  secrets: {
    file: '.dev.vars', originKey: 'APP_ORIGIN',
    values: context => ({ APP_ORIGIN: context.origin, OPERATOR_EMAIL: context.input.OPERATOR_EMAIL.toLowerCase(), PENNY_ENVIRONMENT: 'local', MAIL_PROVIDER: 'development', MAIL_FROM: 'auth@localhost.test', WORKSPACE_TIMEZONE: context.input.WORKSPACE_TIMEZONE || 'UTC' }),
  },
  build: async context => {
    if (context.input.OPERATOR_EMAIL) assertLocalAdmission(context)
    await buildSource((command, args) => context.run('Building your application', command, args, { env: commandEnvironment(), step: 'build' }))
  },
  migrate: async context => {
    const env = { ...commandEnvironment(), PENNY_LOCAL_STATE: context.stateDirectory, CI: '1' }
    await applyMigrations(context)
    // Read native authority; only /auth/bootstrap may create it. A populated
    // store cannot be rebound by changing an email in a local settings file.
    const email = context.vars.OPERATOR_EMAIL
    const sql = `SELECT (SELECT COUNT(*) FROM oa_bootstrap) AS installed, (SELECT COUNT(*) FROM oa_operators WHERE email='${email}' AND role='owner' AND status='active') AS ownerMatch;`
    const output = await admissionOutput(context, 'Checking existing owner authority', 'pnpm', ['exec', 'wrangler', 'd1', 'execute', 'feedback-penny-local', '--local', '--persist-to', context.stateDirectory, '--command', sql, '--json'], { env })
    const installed = [...output.matchAll(/"installed"\s*:\s*(\d+)/g)].at(-1)?.[1]
    const matched = [...output.matchAll(/"ownerMatch"\s*:\s*(\d+)/g)].at(-1)?.[1]
    if (installed === undefined || matched === undefined || (installed !== '0' && matched !== '1')) {
      context.store.report('The local store must be empty or retain this active native owner. No ownership change was applied.')
      throw context.fail('setup')
    }
  },
  // Setup's temporary app is the built production runtime preview uses: no Vite
  // file server, trigger handlers or Local Explorer on the public port.
  start: previewTarget,
  owner: { displayName: input => input.displayName || 'Owner', returnTo: '/setup' },
  signIn: { emailKey: 'OPERATOR_EMAIL', returnTo: '/setup' },
  hosting: async context => {
    if (context.input.target !== 'remote') return ownerAccountHosting({ cli: 'scripts/installer/owner-cli.mjs' })(context)
    const project = (await ownerDeclaration(context.root)).declaration.project.split('/').at(-1)
    if (!context.input.prefix?.startsWith(`${project}-`)) throw context.fail('deploy')
    const target = await ownerDeclaration(context.root, context.input.prefix.slice(project.length + 1))
    return ownerAccountHosting({ cli:'scripts/installer/owner-cli.mjs',declaration:'deploy.json',environment:target.environment,state:target.stateFile,secrets:context=>{
    return {...Object.fromEntries(manifest.fields.filter(field=>['connection','host'].includes(field.group)&&context.hostingInput[field.name]!==undefined).map(field=>[field.name,context.hostingInput[field.name]])),OPERATOR_EMAIL:context.vars.OPERATOR_EMAIL,PENNY_EXPECTED_ORIGIN:context.input.appOrigin,WORKSPACE_TIMEZONE:context.vars.WORKSPACE_TIMEZONE,MAIL_PROVIDER:context.hostingInput.MAIL_PROVIDER||'later',...(context.hostingInput.MAIL_PROVIDER==='sendgrid'?{MAIL_FROM:context.hostingInput.MAIL_FROM,SENDGRID_API_KEY:context.hostingInput.SENDGRID_API_KEY,SENDGRID_EVENT_PUBLIC_KEY:context.hostingInput.SENDGRID_EVENT_PUBLIC_KEY}:context.hostingInput.MAIL_PROVIDER==='resend'?{MAIL_FROM:context.hostingInput.MAIL_FROM,RESEND_API_KEY:context.hostingInput.RESEND_API_KEY,RESEND_WEBHOOK_SECRET:context.hostingInput.RESEND_WEBHOOK_SECRET}:{})}
    }})(context)
  },
  guard: context => { context.signal?.throwIfAborted(); localState(context.root) },
  features,
}
const lifecycle = localInstaller(definitions)
export const commandAdapter = createCommandAdapter(lifecycle, {
  product: 'Penny',
  site: { entry: 'src/site/pages.tsx', output: 'dist/site', declaration: 'deploy-site.json', config: 'vite.site.config.ts' },
  setup: { manifestFile: 'rer-setup.json' }, browserModule: 'scripts/installer/ui/seed.mjs',
  input: { names: { email: 'OPERATOR_EMAIL', name: 'displayName' }, defaults: async () => ({ target: 'local', MAIL_PROVIDER: 'later', WORKSPACE_TIMEZONE: 'UTC' }) },
  // Penny's own environment (no inherited secrets), plus this run's origin, the
  // checkout's dev key and the Local Explorer off.
  dev: context => ['pnpm', ['exec', 'vite', 'dev', '--host', '127.0.0.1', '--port', String(context.runtimePort ?? new URL(context.origin).port), '--strictPort'], { env: { ...runtimeEnvironment(context.root), RER_DEV_ORIGIN: context.origin, X_LOCAL_EXPLORER: 'false', ...(context.devKey ? { RER_DEV_KEY: context.devKey, RER_DEV_IDENTITY: context.devLogin ? 'off' : 'on' } : {}) } }],
  preview: previewTarget,
  localPrerequisites: async ({ root, vars, email }) => vars.PENNY_ENVIRONMENT === 'local' && vars.MAIL_PROVIDER === 'development' && Boolean(vars.AUTH_SECRET) && await operatorPrerequisites(root, email),
  verify: ['pnpm', ['run', 'verify:app']], deploy: deployPenny,
  // Each hydration load fetches fresh real assets. Let the public admission
  // bucket's 60-second window expire before the next load, including the first.
  hydrationLoadDelayMs: 61_000,
  // Local dev identity: the local-only Worker entry, the build output rer build
  // scans for the dev layer, and the kept end-to-end email-link test.
  devIdentity: { entry: 'src/server.dev.ts', output: ['dist'], emailLinkTest: 'tests/installer/readme.test.mjs' },
  localOnlyKeys: ['RER_DEV_ORIGIN', 'RER_DEV_IDENTITY'],
  portability: pennyPortability,
})
