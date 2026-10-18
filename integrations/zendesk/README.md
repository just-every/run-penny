# Penny proxy votes for Zendesk

This private Zendesk Support ticket-sidebar app implements the Zendesk entry
point for CAP-014 only: find a published request, explicitly select an existing
Penny customer or confirm a new unverified contact, review the ticket source,
then record a proxy vote. It does not implement the wider CAP-003 connector.

## Install

1. In Penny's integration settings, create a dedicated API key with only
   `requests:read` and `votes:write`. The key acts as its issuing Penny operator;
   do not share it with agents or put it in source files. Revoke it in Penny
   when removing the app. Removing a Zendesk app does not revoke a Penny key.
2. Replace the manifest’s author name, email and URL with your business contact details. From this directory use Zendesk's ZCLI to validate and package the app:
   `zcli apps:validate` and `zcli apps:package`. Upload the generated ZIP as a
   private app in your Zendesk Admin Center under Apps and integrations →
   Zendesk Support apps. This is installation guidance, not a performed upload.
3. Set `penny_origin` to the installation's HTTPS origin, for example
   `https://feedback.example.com`, with no path, query, credentials or port.
   Set `penny_host` to the exact same hostname, `feedback.example.com`.
   Zendesk's secure-request allowlist takes a hostname without a scheme; the
   app refuses mismatched settings before sending any request.
4. Enter the key in the **secure** `penny_api_key` installation setting. Only
   Zendesk's server proxy substitutes it into the Authorization header.
   The iframe uses the literal `Bearer {{setting.penny_api_key}}` with
   `secure: true` and `cors: false`; the bearer value is never supplied by
   `client.metadata()`, persisted by the app or sent through browser fetch.
5. Open a saved ticket and expand Penny proxy votes. Search using the ticket
   requester's email or a customer name. No match is selected automatically.
   New contacts require an explicit confirmation and keep their address
   unverified. Search for the request, explain what the customer asked for,
   review the linked Zendesk ticket and tick the review checkbox before saving.

Penny must have a valid complete TLS certificate chain and accept Zendesk's
proxy IP ranges. Secure settings cannot be tested with ZCLI's local web server;
use a packaged private app. API refusal, conflict and network errors appear in
the sidebar. Retrying an existing customer's vote adds no second vote. A proxy
vote grants neither verified identity nor email subscription permission. The
ticket link is derived from the SDK's current account subdomain and ticket ID;
the app checks the ticket requester again before writing.

## API contract

All calls use the Zendesk server proxy and a revocable scoped Penny key:

- `GET /api/v1/requests?q=…` (`requests:read`) returns public request cards
  with `slug`, `title`, `status` and optional `statusLabel`.
- `GET /api/v1/proxy-vote-contacts?q=…` (`votes:write`) returns a private
  array of `{id, displayName, email}`. The user must choose an entry explicitly.
- `POST /api/v1/requests/:slug/proxy-votes` (`votes:write`) accepts exactly
  one of `{requesterId}` or `{contact: {displayName, email?}}`, plus required
  `source` and the sidebar's `sourceUrl`. Response: `{requesterId, created}`.
  `created: false` means the customer already supports the request. New-contact
  email conflicts require selecting the existing customer instead.

The key's issuing operator is the recorded Penny actor. This small app does not
assert that a Zendesk agent is a Penny operator, grant consent, infer accounts,
create requests, capture tickets automatically or send replies.

## Evidence and documentation

`tests/browser/zendesk-proxy-votes.mjs` serves these actual assets and replaces
only the external ZAF SDK/proxy edge. It substitutes the key in Node, forwards
calls without a browser Origin to the real built Penny Worker, and exercises
the sidebar at 1440 and 390 pixels through `moderationJourney`. It is bounded
local evidence; real Zendesk installation and proxy delivery need their own
receipt.

Official references checked 19 October 2026:

- [Manifest and hostname allowlist](https://developer.zendesk.com/documentation/apps/app-developer-guide/manifest/)
- [Secure settings and proxy requests](https://developer.zendesk.com/documentation/apps/app-developer-guide/making-api-requests-from-a-zendesk-app/)
- [ZAF client and official SDK CDN](https://developer.zendesk.com/api-reference/apps/apps-core-api/client_api/)
- [Ticket sidebar and requester events](https://developer.zendesk.com/api-reference/apps/apps-support-api/ticket_sidebar/)
- [Current account subdomain](https://developer.zendesk.com/api-reference/apps/apps-support-api/all_locations/)
