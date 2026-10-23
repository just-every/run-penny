// pnpm loads this file for every command in this checkout. During an install,
// including the first one a global `rer` runs on a fresh clone before Penny's
// adapter exists, dependency build scripts (esbuild, workerd, sharp, tailwind)
// inherit pnpm's environment, so provider and application credentials leave it.
// `pnpm exec` and `pnpm run` keep them: deploy commands need their own inputs.
const installs = new Set(['install', 'i', 'add', 'update', 'up', 'upgrade', 'rebuild', 'rb', 'remove', 'rm', 'uninstall', 'un', 'fetch', 'import', 'dedupe', 'link', 'ln', 'unlink'])
const command = process.argv.slice(2).find(argument => !argument.startsWith('-'))
if (command === undefined || installs.has(command)) {
  const credential = /(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY|AUTHORIZATION|COOKIE|CREDENTIAL)/i
  const binding = /^(SESSION_SECRET|INSTALLATION_KEY(?:_|$)|SETUP_TOKEN|OWNER_EMAIL|OPERATOR_EMAIL|APP_ORIGIN|PENNY_ENVIRONMENT|WORKSPACE_TIMEZONE|AUTH_|MAIL_|OIDC_|SENDGRID_|RESEND_|CLOUDFLARE_|CF_|RER_DEPLOY_)/
  for (const name of Object.keys(process.env)) if (credential.test(name) || binding.test(name)) delete process.env[name]
}
module.exports = {}
