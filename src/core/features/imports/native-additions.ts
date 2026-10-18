// These additive policy columns were not part of the sealed saved-import format.
// Existing previews keep their exact hashes. Default values compare as the old
// absent fields; any operator change stays in the custody snapshot and conflicts
// with replacement/reversal instead of being discarded.
export const nativeAdditiveDefaults:Readonly<Record<string,Readonly<Record<string,string|number|null>>>>={
 requests:{latest_status_source:'direct',internal_status_id:null},
 boards:{category_mode:'off',posting_policy:'requesters',comments_allowed:1,show_vote_counts:1,show_voters:0,anonymous_requesters:0,vote_subscriptions:0,vote_subscription_version:1},
}
