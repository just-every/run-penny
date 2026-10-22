# Current bounded claims

CAP-009 uses the platform `email()` door, with provider-edge synthetic Gmail and
Outlook fixtures, private attachment limits, durable Message-ID digests and
notification-loop exclusions. Live Cloudflare Email Routing, a capture address
on an owner's domain and live mail delivery are **NOT RUN**. CONTRACT.md and
ACCEPTANCE.md remain the authoritative status and acceptance records.

Future AI-006 connector or mail reply drafts inherit explicit operator editing
and sending, never auto-send, and a fresh private-value check before publication.

## Published wording override awaiting a release round

NOTIFY-004 previously said: “The Worker has no mail handler and no route accepts
a mail message.” With CAP-009 it now says: “The Worker accepts inbound mail only
through CAP-009’s dedicated platform-invoked email handler; no HTTP route accepts
a posted mail message.” NOTIFY-004 remains done. No issued release metadata is
changed by this contract round.


REQ-039 is qualified with Google and GitHub fixtures at their network edges,
including cookie-free browser completion. Real consent, an owner's OAuth client,
hosted redirect URIs and provider-console acceptance are NOT RUN. WIDGET-006 and
WIDGET-008 inherit: on an SSO-required portal only WIDGET-008 applies; current
Penny has no such portal state. ROLE-002's status is unchanged.
