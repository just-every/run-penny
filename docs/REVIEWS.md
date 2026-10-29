# Review capture

Owners connect a product listing in **Settings → Review capture**. Reviews arrive
as private, unreviewed evidence. The original name is a nullable source name,
never a requester identity or a deliverable address. Review capture does not
subscribe, email, proxy-vote, publish or reply to a reviewer.

## Installation and vendor scope

Apply `0098_review_capture.sql` and `0099_review_outreach_exclusion.sql` with `rer setup` or the existing hosted migration
path. It adds tables and guards; applied migrations remain unchanged. Preserve
expanded schema on source rollback and stop older workers before upgrading.
There is no separate importer or public ingestion endpoint.

Provision the optional `PENNY_REVIEWS_EGRESS` service binding before enabling
capture. Its RPC interface is
`send({url,method,headers,body}) -> {status,headers,body}`. It must enforce public
DNS/IP at connect time, verified TLS, exact GET/POST methods, no redirects, and
request/response bounds of 512 KiB. Ordinary `fetch` is not a substitute. Do not
allow arbitrary hosts in this service: permit only the vendor hosts listed below.
Penny fixes the API origin and listing path and rejects pagination that changes
the listing scope. The browser contacts only Penny.

| Site | Listing identifier | Read interface |
| --- | --- | --- |
| G2 | G2 product ID | G2 Data API survey responses filtered by product |
| Capterra | Owner's product identifier | Exact owner-selected HTTPS public review page on www.capterra.com or www.capterra.co.uk |
| TrustRadius | Owner's product identifier | Exact owner-selected HTTPS public review page on www.trustradius.com |
| Trustpilot | Business unit ID | Trustpilot Business API private business-unit reviews |
| Product Hunt | Post ID | Product Hunt v2 GraphQL post comments with cursor pagination |
| Apple App Store | Numeric App Store Connect app ID | App Store Connect customer reviews |
| Google Play | Android package name | Google Play Developer reply-to-reviews API, read operations only |

Use a vendor-issued credential with read access to the selected listing. For
scheduled work, expand **Renewable vendor credentials** and supply one JSON object:

- App Store: `kind: "appstore"`, `issuerId`, `keyId` and a PKCS#8 `privateKey`.
  Penny signs a fresh ES256 App Store Connect JWT for each read.
- Google Play: `kind: "googleplay"`, the service account's `clientEmail` and PKCS#8
  `privateKey`. Grant that service account review access in Play Console. Penny
  signs an RS256 assertion and exchanges it at Google's token endpoint with the
  Android Publisher scope.
- Trustpilot: `kind: "trustpilot"`, `clientId`, `clientSecret` and `refreshToken`
  from the owner's Business API authorization. Penny renews access and stores any
  rotated refresh token atomically in encrypted installation custody.

Google/Trustpilot access tokens are cached only in encrypted custody until shortly
before expiry. A durable renewal claim prevents concurrent rotation. An interrupted
or ambiguous refresh is never replayed; reconnect with a fresh credential after
checking the vendor account. Disconnect removes credential, cache and renewal claim.
The enforcing service also needs `oauth2.googleapis.com` for Google token exchange;
Trustpilot renewal uses its existing API host. These exchanges issue credentials,
never review replies. No signing key or refresh token reaches the browser again.

G2 and Product Hunt also require the public listing URL in the existing **Public review page URL** field. Their API IDs and public slugs can differ: use the exact G2 `/products/<slug>/reviews` or Product Hunt `/posts/<slug>` URL. Returned review links must remain on that selected listing; Product Hunt comment IDs must also match their anchors. Reconnect earlier installations to supply that scope.

G2 and Product Hunt use the access token issued by their vendor account. A manually
issued access token can also be used for the other APIs, but its expiry then needs
an owner reconnect. Token issuance and account grants remain owner-account steps.
No vendor key is sent to a public review page. Capterra and TrustRadius require
explicit confirmation that their current terms permit the scheduled read. Penny
does not bypass sign-in, robots restrictions, challenges or paid access. Public
pages must expose the selected product's review JSON-LD; missing or changed markup
fails visibly. A `rel=next` page may vary only its page query on that same listing.

The access token is encrypted with an installation-derived AES-GCM key and stored
in installation-only `penny_review_credentials`; settings never return it and
archives omit it. Disconnect deletes that ciphertext, invalidates ongoing work
and stops new reads while retaining evidence. This revokes Penny's local use;
provider-side revocation of an externally issued token remains available in the
vendor account. Rotate vendor credentials there if they were shared elsewhere.
Changing the installation authentication secret requires reconnecting listings.
Never place credentials in source, fixture files, build inputs or public URLs.

## Scheduling, accountability and recovery

The default interval is 24 hours. Owners can choose 1–168 hours; a longer interval
is refused, including for Google Play's rolling one-week review window. A minute
Cron admits due work, at most one page per listing per tick, and checkpoints the
cursor durably. Last complete sync, accountable owner, captured count, pending
extraction count, due time, state and an actionable failure are shown per listing.
Saving assigns the current owner. Loss of that owner's authority stops work.

A provider failure or a worker interrupted for five minutes stays visibly failed
until **Retry sync and source checks**. Retry continues the saved page; rereading
an already captured review creates nothing. **Pause reviews** stops acquisition
and extraction; **Resume reviews** reassigns the accountable owner and continues.
Reconnect restarts a scan under the new configuration without duplicating evidence.
A restore holds every connected listing and carries no token: reconnect in the new
installation before capture can resume.

A site plus its review ID is the inbox identity, including across reconnects and
listings. A wording-free hashed receipt survives source evidence erasure to prevent
a reread from recreating erased content. Review metadata and proposals participate
in the product archive and evidence erasure graph.

## Source history, suggestions and privacy

Penny keeps the captured wording, source time, rating, title, version and country
when supplied, plus a deep link. A provider that supplies no rating, version or
country leaves that value absent; Product Hunt comments have no star rating.
It stores neither full provider payloads nor public-page HTML, profiles, devices,
attachments or neighboring product reviews. Owner redaction rules apply to text
and source names before the write.

A reread marks a different source fingerprint **changed**, preserving the capture.
Source timestamps retain the supplied offset and fractional precision (up to nine digits); Google Play seconds and nanos are combined without millisecond truncation.

Daily source checks mark explicit deletion or lost source access **removed**;
absence from a rolling feed alone never proves deletion. After the owner's
retention window (default zero days), all captured wording versions, source name,
optional wording metadata and derived proposals are purged in an audited
transaction, including while capture is paused. Missing transport remains a
visible failure, not evidence that a source was removed. Product Hunt checks its supported GraphQL `comment(id)` resource, including its ID and saved URL. Public source checks parse the individual page’s selected review identity; a successful page without supported markup is a visible failure. Hash-only legacy links cannot prove absence from a rolling listing and require owner reconciliation.

Request extraction uses the owner's AI capability selection, private-data policy,
monthly budget, reservation and metering. The default budget is zero; capture
continues when AI is unavailable. A proposal contains a problem statement, the
stored source version, UTF-8 byte offsets, its exact span and an optional closest
existing request. Invalid, invented or split-codepoint spans are refused. The
operator uses the existing evidence actions to link or create a request;
extraction takes no public action. Replays do not repeat the model call. An
interrupted paid call is held with a visible failure; reconcile provider usage
before explicitly acknowledging a paid retry. Rewriting a captured version
invalidates its derived exact-span proposals.

## Captured-contact status updates

The operator HTTP interface previews `GET /api/operator/requests/:slug/captured-contacts` and accepts `notifyCapturedContacts: true` on a status-update publication. The preview lists eligible explicit native contacts; review source names are always excluded. The choice and snapshot count are audited with that update. The default is false, a recorded postal address is required, and reusing the publication key cannot send again. Delivery uses the existing durable notification pipeline, suppression and unsubscribe checks. A selected contact receives no permission record and gets the reason for this one update in the mail. The bounded status path supports verified native contact addresses; broader NOTIFY-009 release/decline controls and board defaults remain governed by its unchanged missing status.

## Verification boundary

`tests/browser/review-capture.mjs` is one broad public-door journey against the
emitted Worker, with sanitized, synthetic vendor-response snapshots at the network
edge. It covers all seven adapters, replay, redaction, exact UTF-8 spans, cursor
recovery after an actual Worker restart, concurrent disconnect, source changes and
purging, native archive/restore and evidence erasure. Assertions run at 1440;
changed settings and inbox screens are captured once at 1440 and 390 with layout
and accessibility checks. The existing populated migration journey also exercises
the populated previous-head upgrade and repeated no-op, preserving every preexisting column. Product Hunt queries execute against a separate SDL excerpt transcribed from its vendor reference; every connector traverses a second page. Fixed destination URL/HTML fixtures are independent from captured records and popup responses are never manufactured from Penny’s generated URL or ID. These destination fixtures are synthetic protocol examples, not independent recordings of vendor behavior. They verify the local link contract only. In particular, the App Store web frontend may discard `reviewId` during canonicalization, so its generated link is not proven to open an individual review; a supported vendor permalink or owner ruling is still required for CAP-020’s link acceptance. Do not count the synthetic destination replay as that acceptance proof. These are local source proofs, not live vendor
recordings, hosted Cron/transport provisioning, vendor entitlement, live token issuance/renewal
or an owner-account trial. Those account-dependent checks remain unperformed.
