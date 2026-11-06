# Exact candidate native probes

These execute through the built Worker using native sessions and D1, with mail faked only at its HTTP edge. All passed at the head in LOCAL_RECEIPT.json.

PROBE PRIO-004 point2: native scorecard creation, current owner and invited operator scores, then authenticated scorecard read -> B 0.75 rank 1 and A 0.7 rank 2; explicit means 3.5 and 9 for B, 4 and 4 for A; both attributed input vectors retained. Missing confidence has null contribution, result and rank. Equal 0.7 results share rank 2 in stable request-ID order. Revised weights yield A 0.76 before B 0.72.
PROBE PRIO-004 point3: native definition revision followed by GET with the prior versionId -> identical earlier definition, inputs, components and ranks. A new version begins with no scores. Old-version writes return 409 without product or audit changes.
PROBE PRIO-004 authority: invalid scale and criterion writes return 400; another operator cannot revise the creator's definition; foreign-origin writes return 403; requester and revoked operator writes return 401. Product and audit snapshots stay identical.
PROBE PRIO-004 audit: injected late audit refusal during create, revision and scoring -> 503 and all product and audit rows unchanged.
PROBE PRIO-004 custody: populated source export with two versions and scores, independently owned native import and exact version readback -> rows retained, destination native authority unchanged, source sessions refused for reads and writes. Former scorer erasure retains inputs under Erased operator. Request erasure removes its two version-specific scores, preserves the other request's scores and refuses the old archive.
PROBE PRIO-004 upgrade: apply migration 0110 over populated immediate predecessor, then repeat -> every original product and authority row unchanged; repeated migration ledger unchanged; foreign-key checks empty.
PROBE PRIO-004 isolation: committed native decision, snapshots, linked approved roadmap and public request read before and after scoring -> exact stored and read projections unchanged, scorecard identities and fields absent.
PROBE PRIO-004 point1: none, visible card and all scorecard UI are explicitly omitted from the selected scope. No touched screen or browser proof applies.
