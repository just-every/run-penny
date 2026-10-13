// Existing settings win under Base's publication lock. Recheck the chosen
// owner after that lock, so a concurrent first setup cannot bind another choice.
export function assertLocalAdmission(context) {
  const vars = context.vars
  if (vars.OPERATOR_EMAIL !== context.input.OPERATOR_EMAIL.toLowerCase()
    || vars.APP_ORIGIN !== context.origin
    || vars.PENNY_ENVIRONMENT !== 'local' || vars.MAIL_PROVIDER !== 'development'
    || vars.WORKSPACE_TIMEZONE !== (context.input.WORKSPACE_TIMEZONE || 'UTC')
    || !['AUTH_SECRET', 'SETUP_TOKEN'].every(key => typeof vars[key] === 'string' && vars[key].length >= 32)) {
    context.store.report('The saved installation differs from these choices. Resume its saved owner and settings; setup cannot transfer ownership.')
    throw context.fail('setup')
  }
}

// The shared store keeps a bounded diagnostic tail. A preceding command's
// successful output must never satisfy this command's admission check.
export async function admissionOutput(context, label, command, args, options) {
  const marker = `Penny admission boundary: ${label}`
  context.store.report(marker)
  await context.run(label, command, args, options)
  const output = (context.store.state.logs ?? []).join('\n')
  const boundary = output.lastIndexOf(marker)
  if (boundary < 0) throw context.fail('setup')
  return output.slice(boundary + marker.length)
}
