This synthetic backup and its paired erasure journal were retained by the
catalogue qualification at Penny d4c99123, with migrations through 0071. It has
one request, voter, notification history and original file. It is deliberately
older than the triage settings/status-clock backfill and notification table
rebuild. The installer test restores it through `rer import` before setup,
compares every archived cell and original object, and checks the later backfill.
