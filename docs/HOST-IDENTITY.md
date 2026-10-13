# Sign requesters in from your application

The host server authenticates its own user and signs their supplied identity.
Penny verifies that assertion for requester actions only. It cannot sign an
operator in, verify email consent, approve feedback, publish an update or grant
platform owner authority. Email verification remains available when host sign-in
fails. First-time identity provisioning retains the configured-mail boundary;
existing verified identities may participate while mail is unavailable.

Set the same private `PORTAL_IDENTITY_SECRET` on both servers, with at least 32
characters. Save the exact host HTTPS origins in **Feedback settings → Portal
embedding** (`publicOriginAllowlist`). Remove the former `PORTAL_FRAME_ORIGINS`
binding when upgrading; it is no longer an independent framing policy. Local/test
installations also accept explicit loopback HTTP origins.
Only public portal documents allow these frame ancestors; operator documents
remain restricted to their own origin. Never send a signing key to the browser.

`examples/host-identity/sign.mjs` signs the base64url encoded JSON bytes with
HMAC-SHA256. Required claims are `aud` (Penny's exact APP_ORIGIN), `issuedAt`
(ISO timestamp), `email` and `displayName`. Optional accountId/accountName must
appear together. revenueCents is a nonnegative integer; renewalDate is a real
calendar date; health is supplied text. Commercial context stays operator-only.
Unknown fields, invalid pairs, signatures, audiences, claims older than a day
or more than five minutes ahead fail before provisioning.

For direct same-origin requester requests, send the signed values as
`X-Penny-Identity` and `X-Penny-Identity-Signature`. The iframe example uses the
version-1 `penny-host-ready` / `penny-host-identity` handshake in
`examples/host-identity/embed.js`, checking both message origin and window.
The native portal confirms the signature through `/api/public/identity/host`
and retains the assertion in memory. Reload obtains a fresh host assertion;
no host assertion is written to localStorage or an operator cookie.

The latest signed timestamp/hash is recorded. An exact replay is idempotent;
older claims and different content at the same timestamp conflict. Blocked,
merged or erased identities cannot gain new authority. The business transaction
rechecks current identity and the admitted claim. Erasure retains an opaque
email hash to refuse resurrection; receipts and fences participate in the
product archive, while signing keys remain non-portable. Rotation replaces the
configured key and invalidates every assertion signed by the prior key. Have
the host issue fresh assertions; this version has no overlapping key ring.

For a real local example, create an owner-only JSON file outside the checkout
(mode 0600) with `appOrigin`, `secret`, `password` and server-owned `user` fields
`email`/`displayName`. Use a synthetic user for this demonstration and keep the
password and secret out of source and shell arguments. Configure the running
Penny installation with that secret and the frame origin
`http://127.0.0.1:41870`, then run:

```sh
node examples/host-identity/server.mjs ../host-example.json
```

Open http://127.0.0.1:41870 and sign in with the file's host password. The example
maintains its own host session and signs the configured user server-side; the
iframe submits through Penny's production requester routes. Stop it with
Ctrl-C. This loopback example is not a production host authentication service.
In your real application, reuse your existing authenticated server user in
`signRequester`, rather than copying this demonstration's password/session.

Hosts upgrading from the earlier audience-free format must add `aud` before
enabling this version. Claims and votes never imply email permission. Follow
and email-update choices continue to require an explicit user action.
