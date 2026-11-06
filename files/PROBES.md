# Public-door probe results

These are runtime observations from the existing built-Worker decision journeys, with only mail faked at its HTTP edge.

PROBE DEC-002 confidence and review date: native decision POST, repeated PATCH and GET by slug -> low, medium and high read back; changed date and explicit null read back under the original decision id and slug.
PROBE DEC-002 per-bet assumptions: native bet POST, PATCH and decision detail GET -> independent assumptions persist on each bet, an omitted value is retained, explicit null clears only the selected bet, and commitment preserves both bet identities and their stored assumptions.
PROBE DEC-002 evidence and accounts: native evidence creation and link PUT plus decision detail GET -> the exact supporting and contradicting evidence identities and wording and three distinct affected account identities are returned on the intended bet; existing dimension and snapshot assertions pass.
PROBE DEC-002 eligible requesters: verified requester follow routes, native commitment and roadmap approval, then authenticated decision detail GET -> two eligible identities, including one following two mapped requests, appear exactly once each; unrelated followers are absent. Request mute, unfollow, global mute, mapping withdrawal and native block immediately change the list. Reads do not change any permission record.
PROBE DEC-002 erasure and replay: native erasure preview and execution for the only remaining eligible requester, then replay their follow with the old session -> erasure completes, the list becomes empty, replay is refused with 401, and a subsequent read stays empty.
PROBE DEC-002 operator admission: signed-out GET of the populated operator brief -> 401.
PROBE DEC-002 built page: existing Manage this bet form edits assumptions, native identity verification and follow establish an eligible mapped requester, and a reloaded decision document -> stored assumption text and the exact eligible requester name render. Desktop DOM assertions run at 1440; the changed screen is captured and visually inspected at 1440 and 390, with existing axe and overflow checks.
