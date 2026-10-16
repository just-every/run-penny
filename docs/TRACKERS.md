# Tracker links and receipts

In Feedback settings, connect Linear with a personal API key (Penny lists your
teams by name) or Jira Cloud with your site address (such as
`https://your-team.atlassian.net`), the email you sign in with and an API token
(Penny lists your projects and their issue types by name). The page shows the
webhook URL to paste into the tracker before you save; a copy of Penny running on
your computer (`127.0.0.1`) says Linear and Jira cannot reach it, so use the hosted
copy's URL. Enter the webhook signing secret privately. An API token is optional for linking an existing issue;
Jira creation also needs the token owner's email. These secrets remain in the
installation, cannot be read back, and must be re-entered after data restore.

Open a request's discussion controls or a decision brief to deliberately link a
stable issue ID and its HTTPS URL. Linear links use `linear.app`; Jira links use
the configured `*.atlassian.net` site's `/browse/KEY-number` path. Penny rejects
credentials, fragments, query tokens, other hosts and conflicting subject links.

Remote creation sends only the title and description entered in that form.
Linear uses a personal-key authenticated `issueCreate` GraphQL mutation; Jira
Cloud uses `POST /rest/api/3/issue` with an ADF description and API-token Basic
authentication. A complete, matching provider response is required for a known
issue. [Linear API](https://linear.app/developers/graphql),
[Jira create issue](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/).

Creation requires the installation-owned `PENNY_EGRESS.send` RPC contract
described in [INTEGRATIONS.md](INTEGRATIONS.md). Without it, creation is
configuration-disabled; linking and authenticated inbound receipts still work.
The current owner deployment declaration cannot provision that port. Its service
binding and enforcing service are an upstream deployment prerequisite, not an
ordinary fetch fallback. No hosted tracker connection is established by local
tests.

The create command and immutable body are durable before dispatch. Repeat the
same action to observe its existing receipt. Changed wording with the same
command identity conflicts. A lost response or failure to store an accepted
issue is uncertain and never automatically creates again. Find the issue in the
provider, then enter its known ID and HTTPS URL under **Reconcile known issue**.
This records acceptance without another send. Restored commands are held.

Configure the receipt path shown in Settings on the provider. Linear verifies
`Linear-Signature` as SHA-256 HMAC over the original bounded body, requires an
Issue create/update event and the configured organization/team, and checks the
signed `webhookTimestamp` for freshness. Jira's administrative webhook secret
uses `X-Hub-Signature: sha256=…` over original bytes; Penny accepts issue-created
and issue-updated events for the configured project and records
`X-Atlassian-Webhook-Identifier`.
[Linear webhook protocol](https://linear.app/developers/webhooks),
[Jira webhook protocol](https://developer.atlassian.com/cloud/jira/platform/webhooks/).

Receipts, source update time and linked state commit in one native D1 transaction.
Duplicates acknowledge the stored identity, older updates retain the newer
state, and conflicting states at the same source time refuse. Invalid signatures,
wrong projects, revoked connections or changed installation authority cannot
mutate state. Tracker URLs and state are operator-only evidence. They do not
grant email permission, change Penny status, approve a roadmap or publish a
release. API enrichment and general tracker synchronization remain excluded.

Portal branding lives in `src/branding.json` with Penny's own vector mark.
The installation owner can set a readable accent and description and hide or
show the mark in Settings. Those safe product settings are included in exports.
An owner account currently receives its deterministic workers.dev origin. A
custom hostname requires separately authorized Cloudflare domain/route setup;
the adopted shared owner declaration has no domain provisioning field. Do not
change `APP_ORIGIN` or DNS to claim custom-domain acceptance before that path is
implemented and authorized. No real hostname is provisioned by this source proof.
