// pnpm loads this file before every install of this checkout, including the
// first install a global `rer` runs on a fresh clone before Penny's adapter
// exists. Dependency build scripts (esbuild, workerd, sharp, tailwind) inherit
// pnpm's environment, so provider and application credentials leave it here.
const credential = /(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY|AUTHORIZATION|COOKIE|CREDENTIAL)/i
const binding = /^(SESSION_SECRET|SETUP_TOKEN|OWNER_EMAIL|OPERATOR_EMAIL|APP_ORIGIN|PENNY_ENVIRONMENT|WORKSPACE_TIMEZONE|AUTH_|MAIL_|OIDC_|SENDGRID_|RESEND_|CLOUDFLARE_|CF_|RER_DEPLOY_)/
for (const name of Object.keys(process.env)) if (credential.test(name) || binding.test(name)) delete process.env[name]
module.exports = {}
