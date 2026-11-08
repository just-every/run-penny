# Native audit reads

Owners and Admins can read existing audit metadata with `GET /api/operator/audit`
and download it from `GET /api/operator/audit/export.json` or
`GET /api/operator/audit/export.csv`, using their current native session cookie.
Members, requesters and signed-out callers cannot read these routes. Revoked
sessions cannot continue an export.

All three routes accept the same exact-match filters: `actor` (product actor id),
`action`, `subject` (entity id) and optional `subjectType`. `from` and `to` are
inclusive ISO timestamps with an explicit timezone; offsets normalize to UTC.
`limit` defaults to 50 and accepts 1 through 200. Unknown, repeated or invalid
parameters return 400.

Results use descending event time, then descending event id. JSON contains
`items`, the filtered `total` and `nextCursor` (null on the last page). CSV has
the same event columns in the same order; its total and continuation are in
`X-Audit-Total` and `X-Audit-Next-Cursor`. Every export is bounded to one page:
follow the continuation with the same filters until it is absent. A continuation
can be used across all three formats and with a different page size. It excludes
events appended after the first page, even when their timestamps are backdated.
Start a new traversal to include new events. Current authority and erasure state
are checked on every page; the cursor never preserves erased personal data.

The projection matches the existing agent audit tool: event identity, actor,
action, subject, time and existing agent, sponsor, preparer, approver and door
attribution. It never loads `details_json`, person records, customer wording,
commercial values or credentials. CSV quotes every field, escapes quotes and
newlines, and prefixes spreadsheet formula cells with an apostrophe. Downloads
are private and never cached. The existing agent tool and its policy are unchanged.

This is the native API slice of ROLE-004. An audit screen, completeness across
all privileged actions and the broader privacy certification remain unfinished.
Existing operator-erasure custody remains authoritative; no migration or
configuration change is required.
