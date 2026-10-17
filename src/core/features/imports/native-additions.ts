// These additive policy columns were not part of the sealed saved-import format.
// Existing previews keep their exact hashes. Default values compare as the old
// absent fields; any operator change stays in the custody snapshot and conflicts
// with replacement/reversal instead of being discarded.
export const nativeAdditiveDefaults:Readonly<Record<string,Readonly<Record<string,string|number>>>>={
 requests:{latest_status_source:'direct'},
}
