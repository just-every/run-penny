/**
 * Server-only deployment choices. These values are deliberately separate from
 * the public `config.ts` module: importing the public landing must never bundle an
 * operator address or an embedding allow-list into the client.
 *
 * Example: add `owner@northstar.example` to `operatorAllowlist` when that
 * person may receive a real D1-backed operator session.
 */
export const runtimeConfiguration = {
  operatorAllowlist: ['owner@penny.invalid'],
  workspaceTimezone: 'Australia/Brisbane',
  publicOriginAllowlist: ['http://localhost:5173'],
} as const
