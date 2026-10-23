# Connect an MCP client

Penny accepts Streamable HTTP JSON-RPC at `POST /api/mcp` on your installation.
Use an existing scoped API key in `Authorization: Bearer YOUR_KEY`. Keys are
created and revoked in Feedback settings → Integrations. Never put a key in a URL.

This endpoint implements the
[2025-11-25 MCP lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
and [JSON-response Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
It supports `initialize`, `notifications/initialized`, `ping`, `tools/list`
and `tools/call`. Send `Accept: application/json, text/event-stream`, use
`Content-Type: application/json`, and send the negotiated `MCP-Protocol-Version`
header after initialization. There is no session identifier or SSE stream;
GET and DELETE return 405. Responses are private and are not cached.

- **`search_requests`** requires `requests:read`. Use public request filters such as `q`, `board`, `status` and `sort`. Returns approved customer-safe requests.
- **`read_roadmap`** accepts any valid key. Use empty input. Returns the portal’s approved customer-safe roadmap.
- **`add_feedback`** requires `requests:write`. Send `title`, `description`, `boardSlug` and optional `evidenceIds`. Captures an unpublished request awaiting review and returns its slug.
- **`record_proxy_vote`** requires `votes:write`. Send `requestSlug` and `vote`, using the REST proxy-vote input: one `requesterId` or `contact`, a `source`, optional `sourceUrl`, `evidenceId` and `importance`. Records demand without verification or notification consent.

Tool discovery includes only tools the key may call. Every call rechecks the
key, its issuer, revocation and expiry through the same authority as the REST API.
Capture uses the same services and operator audit as REST, with a key usage receipt.
A scope error makes no product change. Read tools never expose private notes,
private evidence or commercial context. Tool results contain text JSON; captures
return acknowledgements rather than private person records.

OAuth and evidence search are not available. Private evidence has no scoped-key
permission in the current API contract. No client-specific integration or hosted
client receipt is claimed by the local conformance test.
