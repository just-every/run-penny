# Requester identity and file custody repair

This is the second local requester-board repair after `aae03ad`. It addresses the five
source findings and the independently reproduced rejected-attachment reversal.
It preserves the first repair and does not grant integration or deployment.

- Follow activity selects the current slug only when its canonical request is
  published and public. Otherwise it exposes the original followed reference,
  labels it previously followed, and retains mute/unfollow controls. It never
  reveals a newly associated internal canonical slug.
- An attachment reservation owns a durable `writing` claim before entering R2.
  A D1 trigger refuses maintenance admission while any writer is active. Starting
  a new upload/recovery is itself subject to maintenance admission. The claim is
  released after the storage promise settles, and finalization checks custody.
  Erasure can finish only after actual writers settle and its R2 deletion returns.
  It cannot delete a reservation out from under a live put. Recovery holds the
  same claim while checking or replacing missing bytes with the original file.
- Requester writes assert the currently verified requester/address/session and
  active identity in the same D1 transaction as their effects. Public eligibility,
  ownership and rejected-subject admission are also checked there. Native HTTP
  callers propagate their authenticated session and address. An identity moved
  by a merge is rejected as stale; the same browser's next authentication resolves
  the survivor. A transient assertion table is empty after commit and rolls back
  with every failed action.
- Migration 0008 corrects unsupported vote origins reconstructed by 0006 when a
  later current vote proves the old transfer was removed. It does not rewrite
  0001–0007 or old business/history cells. The prior-schema checks start from both
  0005 and 0007 and exercise removal/re-vote, unchanged transfers and overlapping
  contributions through reversal. Timestamp-equal histories and origins already
  incorporated into a 0007 projection have no retained revocation event with
  which to distinguish them; existing ledger evidence is retained in that
  ambiguity. No recovered history is invented or claimed.
- Every held-action replacement receives a fresh durable identity. Claim,
  completion, rejection and retry address only the selected identity, so an older
  replay cannot delete or clear the claim of a newly accepted replacement.
- Once an attachment has transferred, its custody follows later graph reversals
  even if moderation rejects the file. The rejection and original R2 bytes remain;
  the public response stays 404.

## Interrupted writers

A process that dies before releasing an upload claim keeps maintenance blocked.
There is no age-based takeover. The native operator recovery form requires
confirmation that the prior upload process has stopped before releasing that
claim. As with data-runner recovery, the product cannot independently prove an
operator's process-quiescence assertion. Do not confirm it for a running upload.
An ordinary erasure cannot invoke or bypass this recovery step. Migration 0008
conservatively marks every preexisting upload reservation as writing. Stop old
application workers before switching to the corrected version, then explicitly
release interrupted reservations only after their old writers are quiescent.

All new scheduling wrappers and synthetic records live in tests. The storage
interleavings execute native R2 writes and inspect exact original bytes and the
empty bucket after erasure. SQL/source findings are not described as runtime
proof. Browser evidence uses the emitted local Worker and synthetic local outbox;
no provider send is exercised.

Historical verification and browser manifests were captured privately and are
not distributed. Re-run the current [acceptance checks](../ACCEPTANCE.md). Added current-schema cases
share one Worker entrypoint with separate identity, custody and pending modules;
each prior-schema migration starts in its own isolated native D1 worker. Original tests, fixtures, runner, dependencies and migration
history remain unchanged. No timeout or assertion was relaxed.

installation bootstrap, accepted Base operator-auth, mail and deployment adoption, local-adapter removal before the
applicable merge, actual mail/provider acceptance and requester-notification delivery remain
external obligations. Parent owns the fresh gate, push and history-preserving
main integration. This is a local candidate, not a complete product launch.
