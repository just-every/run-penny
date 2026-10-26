This synthetic backup keeps the ten rows and original file retained by the
catalogue qualification at Penny d4c99123, with migrations through 0071. The
fixture was freshly exported by rer 0.2.80 from a real local D1 database at that
schema, retaining its complete schema-object inventory. Every archived row and
original object stayed identical to the earlier fixture. The maintained exporter
excludes its now-reserved empty import assertion table.

It is deliberately older than the triage settings and status-clock backfill and
notification table rebuild. The installer test restores it through `rer import`
before setup, compares every archived cell and original object, and checks the
later backfill. Legacy v2 archives without `schemaObjects` are refused by rer
0.2.80; this fixture does not claim recovery of that format.
