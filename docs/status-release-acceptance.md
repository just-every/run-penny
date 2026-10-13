# Status updates and releases acceptance — 8 October 2026

Acceptance written before implementation. All checks below are required; no check is implied by code existing.

- ROAD-007/008: approved transitions atomically create one private safe draft; publish produces every mapped request history and one identity intent; replay/concurrency are inert; failure rolls back publication; safe fields only.
- REL-001/002/003: editable drafts require real tags, author, date, targets and Shipped items; validation names every deficiency; publish freezes wording and complete target/recipient contexts atomically before delivery; published edit refused.
- REL-004/005: consent binds the selected verified address, deduplicates identities across requests, honors mute/suppression/retirement, preserves snapshots after follow/unfollow/merge, and filters contexts immediately before sending. No other recipient or internal content appears publicly or in mail.
- NOTIFY-002, REL-006/007/013: status keeps fixed first-event one-hour windows; releases bypass those windows but honor 20:00–08:00 workspace quiet hours. Stable claims/keys prevent concurrent or accepted/unknown replay. Known rejection retries at most five times within one hour. Signed callbacks verify ownership, deduplicate IDs and advance monotonically.
- REL-010: empty feed has no drafts/examples/outcome prompts. Request and release pages display actual queued/sent/suppressed/failed/unknown delivery counts.
- DATA-001/003: additive upgrade preserves original notification rows; every new table enters archive/restore; requester erasure removes personal contexts/attempts/receipts while public wording is byte-identical; active sends exclude maintenance. Existing all-table Worker and notification custody tests stay unchanged.

Provider caveat: SendGrid deliveryId is correlation, not provider-side duplicate suppression. The owner resolved the transport policy on 8 October 2026: retain SendGrid, keep ambiguous attempts unknown and never automatically replay them. REL-007's provider duplicate-suppression guarantee remains explicitly unsatisfied. Genuine Base's documented missing-message-ID event exclusions remain; REL-011 is not fully satisfied.
