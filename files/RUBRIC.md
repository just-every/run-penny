# Frozen original-outcome rubric

Frozen before focused execution, 2026-11-06. The supplied original inline request contains the acceptance points, outcomes and riders, but no pre-existing stable-ID rubric. No earlier exact-source CT judgment is present in the bounded supplied inputs or pinned repository reports. This rubric freezes only those original outcomes. No held-out material was accessed and no mutation is applied.

Clause: REQ-015 — Status updates. Requirement: An operator can publish a status update on a published request.

| ID | Original item | Verification already named in original request |
| --- | --- | --- |
| R1 | It is rendered distinctly from comments. | `tests/browser/requester-repair.mjs`: requester repair, distinct status identities and cards separate from the populated approved-comment region, lines 64–87. |
| R2 | It can be pinned above comments. | Same browser journey: older pinned update precedes newer unpinned update, which precedes the approved comment, lines 64–87. |
| R3 | It enters the request history. | Same browser journey: exact history and comment identity and unchanged history after reload, lines 64–87. |
| R4 | It notifies followers under NOTIFY-001. | `tests/base/notifications.test.ts`: pinned status publication reaches its follower once; native operator publication, eligible-recipient mail containing the exact public wording once, and repeat publication and Queue replay send no duplicate. The same named file covers no-consent, held-comment, private-content, suppression, mute, unpublished and internal-board boundaries. |
| R5 | Setting a request's status (REQ-036) publishes one. | `tests/browser/requester-repair.mjs` lines 60–70 and `tests/base/request-status-workflow.test.ts`: sets a direct plan and ETA, resolves latest changes; public status and recorded status updates, no-op save and refused invalid decline. |

DONE-RIDERS 1–11 are scored separately without adding a product acceptance outcome. There is no written Base-duty citation on REQ-015 and no additional receiving-duty delta assigned by this request. NOTIFY-001 and REQ-036 are explicit inherited references. Their other independently owned clauses are not promoted by this judgment. No live provider, real device, legal or other-clause qualification is inferred from fixture proof. Field proof remains external.
