# Requester-board first repair record

This local repair follows candidate `c44ff75ee1e5999ecfa7594031d272f21353190a`.
It preserves the authorized A/B port, applied history, native authority, existing
public projections and A's archive/erasure custody. It does not establish main
integration, deployment, remote migrations or provider delivery.

| Finding | Source behavior and regression |
| --- | --- |
| F01, F02; source 1, 2, 9, 10, 14 | Atomic graph validation and origin-ledger projections; both chain reversal orders, overlap, new canonical actions, retired identity, source withdrawal, revoked/muted consent, real D1 late-fault rollback, interleaved revocation and opposite merges. |
| F03, F08 | Submission checks transport before any identity/write; supplied invalid credentials cannot become anonymous holds. Tests distinguish configured/unconfigured, absent, valid host and invalid/revoked bearer/host credentials. |
| F04 | Native operator authority on exact evidence-tag PUT/DELETE transports, with validation and private public projection. |
| F05 | Permission existence checked inside the transaction; repeated/concurrent follows, vote-with-updates and verification replay retain one active permission for the same address/request. |
| F06; source 11 | Declines preserve the preceding state transactionally; repeated/concurrent declines and reversal tested. |
| F07, F10; source 16 | Withdrawn pending items leave actionable moderation; initial content is not an edit; duplicate selection buttons are non-submit controls and show vote/follow success without a submission claim. Actual browser journeys exercise these controls. |
| F09 | Manifest `roadmapItem` entity supported, legacy `roadmap` alias retained, typed value/entity validation tested. |
| Source 3, 4, 5 | Detail dependencies share one D1 snapshot; internal-board status writes refused; every public mutation/anonymous hold has IP and identity limits; multipart total stream bounded before parsing and unsupported parts rejected. |
| Source 6, 7, 15 | Canonical held/direct submission hashes, terminal pending-action progress/rejection reporting, immutable consumed-link recipient binding and concurrent replay tested. |
| Source 8 | Audited operator appeal resolution can reopen rejected edits for a new verdict or retain rejection with a reason; real API and mounted UI tests. |
| Source 12, 13 | All new tables fenced during maintenance; upload reservation preserves R2 through ambiguous D1 responses, operator recovery verifies original bytes, export refuses incomplete custody and erasure includes pending bytes. |

The ten runtime findings and sixteen source findings overlap as shown above.
Source review alone was not treated as runtime evidence. Added tests run real D1,
R2 and native HTTP routes; test-only transport faults wrap real D1 operations.
Synthetic identities/outbox records and interrupted-upload fixtures are local test
inputs. No application mock, failure-hiding fallback or original-test edits were used.

All 15 original A `tests/` files and its one sample fixture are byte-identical;
all four applied migrations and candidate 0005 are byte-identical. Dependencies,
lockfile and test runner configuration are unchanged. The new migration numbers
0006/0007 remain provisional for integration and have been applied only to isolated
local test stores. The preserved original `82aaf88` must remain in root's eventual
non-reset merge.

Historical verification used Node 22.23.2 and pnpm 8.15.6 with isolated local
D1/R2 stores and test-only mail capture. Private execution logs and browser
manifests are not part of this distribution. Re-run the shipped checks for the
current candidate; see [acceptance](../ACCEPTANCE.md).

Open obligations: installation bootstrap inbound CI/bootstrap; accepted Base operator-auth, mail and deployment
integration and removal of the local auth adapter before the gated merge; provider
acceptance and notification delivery (requester-notification); independent repaired-head gate and
root's integration decision. Notification outbox rows remain intent only. This is
not a whole-task DONE or a launch receipt.
