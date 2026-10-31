# Survey capture

An owner selects forms under Feedback settings → Survey capture. Each form has
a stable connection name, a provider form ID, the open-text question IDs to
capture, and explicit question-to-private-attribute mappings. Optional email and
account mappings can select a question or a hidden field named
`hidden.field_name`. Google Forms exposes collected respondent email as
`hidden.email`. Accounts match an existing ID or slug; an existing requester
can also supply its existing account link. A valid, unredacted email can match
an existing requester or create an unverified address. Capture never verifies an
address, creates a session, changes an existing address's authority or grants
email permission.

The response link template is an owner-selected HTTPS link to the response in
the source application's operator view. Copy that application's response link
and replace its response ID with `{responseId}`. It must contain no credentials,
port. The source may require its own sign-in.

## Installation and provider setup

Keep credentials in the optional installation secret `PENNY_SURVEYS`: a JSON
object keyed by the connection names selected in the UI. Never put credentials
in a mapping or response URL. Each connection's object accepts:

- Typeform: `token` for responses read access and `webhookSecret`.
- SurveyMonkey: `token`, `clientId` and the app's API secret as
  `webhookSecret`.
- Google Forms: a current OAuth access `token` with
  `forms.responses.readonly` and access to the selected form.
- Pencil: its credential-free HTTPS `origin`, an installation-owned
  authenticated operator `cookie` for that form's ledger, and the endpoint's
  `webhookSecret`. Pencil currently exposes this read through its operator
  ledger rather than a scoped response API; an expired/revoked session is a
  visible failure requiring the owner to replace the credential and retry.

Bind an enforcing RPC service as `PENNY_SURVEY_EGRESS`, with
`send({url,method,headers,body}) → {status,headers,body}`. It must restrict the
fixed HTTPS provider hosts (`api.typeform.com`, `api.surveymonkey.com`,
`forms.googleapis.com`) and the configured Pencil origin, validate DNS/IPs,
refuse redirects and private destinations, enforce TLS, a request timeout and
a 256 KiB response bound. There is no ordinary-fetch fallback. The service
carries authorization; it must not log headers or response bodies. Without this
binding and the named credentials, enabling capture is refused.

Register the displayed `/api/integrations/surveys/<connection-name>` URL:

- Typeform sends `form_response` events, signed in `Typeform-Signature`
  as `sha256=<base64 HMAC-SHA256 of exact body>`.
- SurveyMonkey sends `response_completed`, `response_updated` and
  `response_deleted` notifications. `Sm-Apikey` must equal the configured
  client ID. `Sm-Signature` is the base64 HMAC-SHA1 of exact body keyed by
  `clientId&apiSecret`. The notification's selected survey and response IDs
  drive a separate authenticated response-details read.
- Pencil sends `response.created`, `response.updated` and
  `response.deleted`. `Pencil-Signature` is `sha256=<hex HMAC-SHA256 of exact
  body>`. Penny then reads only that form's authenticated ledger and selects
  the named released response, following bounded ledger offset pages. No answer is accepted from the event itself.
- Google Forms has no Penny webhook. Minute Cron resumes bounded Forms API
  pages, then checks again hourly. Page tokens and work claims are durable.

Register only the selected forms with the provider and limit provider grants to
those forms where supported. Google tokens need owner-managed renewal; no OAuth
refresh token is stored in product data. SurveyMonkey's registration can probe
the URL with HEAD; this returns 200 for a configured selected SurveyMonkey form.

## Progress, recovery and privacy

The connection shows its accountable owner, due time, run attempts, failures and
per-response states. Retry explicitly resumes failed/interrupted work. Stop
fences unfinished reads. Saving a changed map stops unfinished captures and
discards their previously selected payload; Retry reads under the new mapping.
Changing the provider/form identity requires a new connection name.

New responses land once as unreviewed evidence, with one source link and private
attributes. Only selected fields are redacted and persisted, never a provider
envelope or an unmapped answer. Source edits mark the capture changed and retain
its original version. Source deletion or revoked access marks it removed.
Minute Cron purges all excerpt versions and private attribute/contact copies
after the owner-selected retention window, including while capture is paused.
Purges record a wording-free audit event. A failed purge remains visible in the connection's progress until the owner retries work; due purges continue while capture is paused or failed. No source capture publishes a request,
casts a vote, notifies a person or commits a decision.

Migration 0107 is additive. Apply it through the normal `rer setup` or hosted
migration runner; repeat setup is a no-op for applied migrations. Source rollback
keeps the expanded schema. Pause survey connections before running older source;
do not remove applied migration history or drop survey tables to roll back.

Archives include selected survey data and replay hashes, exclude credentials,
disable connections and hold pending/running/failed work on restore. Re-enable
and retry only after the new owner reviews scope and credentials. Evidence or
requester erasure traverses the source and job copies. Wording-free response
hashes prevent a replay from recreating erased evidence. Sealed selection and
attribute copies are counted by redaction reapplication and use the existing
Data erasure path; initial capture always uses current redaction rules.

`node tests/browser/survey-capture.mjs` exercises the emitted Worker through
HTTP, Cron and the browser, with recorded provider-shaped responses only at the
network edge. It covers all four providers, signed replay, scope, private
mapping, non-authorizing contacts, interruption/retry/stop, source changes and
purges, archive/restore/erasure, and both 1440 and 390 pixel views. This is local
proof: live provider registration, real response links and consent, renewing
credentials, enforcing hosted transport and hosted Cron remain owner-account
field proof.
