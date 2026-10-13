/**
 * Server-only deployment choices. These values are deliberately separate from
 * the public `config.ts` module: importing the public landing must never bundle an
 * operator address or an embedding allow-list into the client.
 *
 * Operator membership is managed in Feedback settings. The installation's
 * initial operator configuration does not grant removed members access again.
 */
export const runtimeConfiguration = {
  operatorAllowlist: ['owner@penny.invalid'],
  workspaceTimezone: 'Australia/Brisbane',
  publicOriginAllowlist: [],
} as const
