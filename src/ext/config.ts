import branding from '../branding.json'

/**
 * BUYER-OWNED CONFIGURATION
 *
 * Replace these values to make the public portal your own. Example: set
 * `ownerName` to "Northstar" and `portalDescription` to a concise explanation of
 * what Northstar's customers can do here. `showPoweredByCredit` switches the
 * "Powered by" credit in both the portal footer and the product landing at `/`
 * (whose own copy lives in src/core/features/landing/copy.ts).
 */
export const publicLandingConfig = {
  ownerName: branding.name,
  portalDescription: branding.description,
  showPoweredByCredit: true,
} as const
