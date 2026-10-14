# Penny data foundation

Historical implementation record. Commands and startup behavior below describe
that milestone; use README.md, OPERATIONS.json and current package scripts for
the maintained terminal/outbox path. This record is not current acceptance.


The data foundation establishes the first immutable D1 migration and a
service-driven local sample import. Public and operator reads now build on this
foundation; their explicit DTOs and route boundaries are documented in
`docs/read-spine.md`. The importer itself does not add an authentication bypass,
a development-only data route, or a mail-provider substitute.

## Durable model

`migrations/core/0001_initial_data_foundation.sql` creates the initial core
records for operators and sessions; accounts and requester identities; boards,
tags, evidence and immutable versions; requests and their current public
records; decision briefs and commitment snapshots; roadmap records and their
public-projection boundary; releases, versions, recipient snapshots, and
outcomes; plus custom fields and audit records.

The matching Drizzle definitions live in `src/core/shared/schema.ts`. Feature
repositories are the only code that creates a Drizzle D1 client. The import
services enforce the sample's graph invariants before issuing writes: public
requests need approved public content, committed decisions need a durable
revision, a selected bet belongs to its decision, and a roadmap transition must
produce the stored roadmap status.

## Curated sample

`sample-data/penny.v1.json` is deliberately small. It preserves the
historical owner direction (private research is excluded from distribution):
Northstar Health, Caldera Finance, Brightwell, Studio North; the three
attributed sales/support/portal signals; the SCIM-versus-shared-threads
decision; two public requests; and the customer-safe SCIM release draft.

It does not copy generated prototype CRM settings, user contact information,
scores, budgets, fabricated usage/adoption figures, static browser state, or
third-party dependencies. The draft release has no recipient snapshot or
outcome because mail delivery and requester verification are not implemented.

## Local development and verification

The local migrations apply through `rer setup` (or `import`), which
leave an empty store; no command loads the sample into a local installation. The
Worker test pool imports `sample-data/penny.v1.json` through the same feature
services and repositories as later product writes (`importPennySample`), so the
real D1 read and trust-boundary suites run against it. It is not mounted by the
production Worker and no GET route can seed data. `rer verify`
runs those suites.

## Deferred backend work

This foundation intentionally does not claim behaviour for native sign-in
issuance, requester verification, moderation, request mutation, attachments,
FTS, decision review scheduling, public-projection mutations, release
publication/delivery, provider callbacks, outcome submission, export/import,
or custom-field editing. Public and operator **reads** are real; their records
are structured so later feature services can implement the remaining contract
without replacing the data spine.
